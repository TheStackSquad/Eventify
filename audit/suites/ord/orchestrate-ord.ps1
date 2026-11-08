# audit/suites/ord/orchestrate-ord.ps1
<#
.SYNOPSIS
  ORD suite orchestrator (orders, payments, tickets). Started by audit\runner\run-orders.ps1, which holds the
  run lock and, in tunnel mode, starts the rig database first. This script only orchestrates; the logic lives in:
    audit\error\error-helpers.ps1       Invoke-Step
    audit\matrix\helpers.ps1, setup.ps1 read-only: HTTP, SQL, recording, rig and tunnel setup
    audit\suites\ord\ord-helpers.ps1    safety, invariants, sessions
    audit\suites\ord\fixtures-ord.ps1   AUDIT-ORD events and tiers
    audit\suites\ord\checks-*.ps1       the checks (P0: schema)
    audit\suites\ord\hints-ord.ps1, report-ord.ps1
  Exit codes: 0 all good, 1 a check failed, 2 a step failed.
#>
[CmdletBinding()]
param(
    [ValidateSet('rig', 'tunnel')][string]$Mode = 'rig',
    [string]$ComposeFile = 'audit/docker/docker-compose.loadtest.yml',
    [string]$LoginPath = '/auth/login',
    [string]$CsrfCookie = 'csrf_token',
    [string]$CsrfHeader = 'X-CSRF-Token',
    [int]$Burst = 0,
    [switch]$SetupOnly,
    [switch]$Manual,
    [switch]$Reset,
    [switch]$StartRig,
    [switch]$ApplyMigrations,
    [switch]$ReuseBackend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------- repo root and the variables the shared helpers read

$RepoRoot = $PSScriptRoot
while (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'backend'))) {
    $parent = Split-Path -Parent $RepoRoot
    if ((-not $parent) -or ($parent -eq $RepoRoot)) {
        Write-Host "Could not find the repo root (a folder containing 'backend') above $PSScriptRoot" -ForegroundColor Red
        exit 2
    }
    $RepoRoot = $parent
}
$AuditDir   = Join-Path $RepoRoot 'audit'
$BackendDir = Join-Path $RepoRoot 'backend'
$ResultsDir = Join-Path $AuditDir 'results'
$Rig        = ($Mode -eq 'rig')

$Port = 8081
if ($env:BACKEND_PORT -match '^\d+$') { $Port = [int]$env:BACKEND_PORT }
$NgrokDomain = [string]$env:NGROK_DOMAIN

# Defined up front: matrix\helpers.ps1 and setup.ps1 read these, and strict mode rejects undefined variables.
$Price          = @{}
$Results        = New-Object System.Collections.Generic.List[object]
$Started        = @()
$KeepTmp        = $false
$RigPorts       = @()
$ComposePath    = ''
$RigFrontendUrl = $true
$RunInfo        = @{
    BackendReused = $false; Tunnel = ''; Manual = [bool]$Manual
    PaystackMode = 'test mode (real Paystack)'; StubBase = ''; WorkerInterval = ''
}
$Ctx = @{ Reach = $null; Organizer = $null; Buyer = $null; Guest = $null; OrganizerId = ''; Events = $null; Tiers = @{} }
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ('eventify-ord-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Tmp | Out-Null

$HelperFiles = @(
    'error\error-helpers.ps1',
    'matrix\helpers.ps1',
    'matrix\setup.ps1',
    'suites\ord\ord-helpers.ps1',
    'suites\ord\fixtures-ord.ps1',
    'suites\ord\checks-schema.ps1',
    'suites\ord\hints-ord.ps1',
    'suites\ord\report-ord.ps1'
)
foreach ($file in $HelperFiles) {
    $path = Join-Path $AuditDir $file
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "Missing helper file: $path" -ForegroundColor Red
        Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue
        exit 2
    }
    . $path
}
Set-Endpoints

$CheckCrashSolution = 'The check could not run (a crash, not a failed test). Usually the database or the backend became unreachable mid-run: confirm both are still up, then re-run.'

# ---------------------------------------------------------------- run

$exitCode = 0
try {
    Write-Host "=== Setup (ORD, $Mode mode) ===" -ForegroundColor Cyan

    if ($Rig) {
        Invoke-Step -Name 'Reading rig settings from the compose file' -Detailed -Action {
            Get-RigConfig
            Set-Endpoints
        } -Solution "Check the -ComposeFile path, that Docker is running ('docker version'), that Compose v2 is installed, that the compose file defines services named db and backend, and that RSA_PRIVATE_KEY / RSA_PUBLIC_KEY are set in audit\docker\.env or your shell."
    }

    Invoke-Step -Name 'Validating required environment variables and safety rules' -Action {
        Assert-OrdSafety
    } -Solution 'Set the missing variables in audit\docker\.env: AUDIT_VENDOR_EMAIL and AUDIT_VENDOR_PASSWORD always; in tunnel mode also PAYSTACK_SECRET_KEY (sk_test_) and AUDIT_DB_URL (localhost, a database named loadtest, audit or test).'

    Invoke-Step -Name 'Checking required tools are on PATH' -Action {
        $tools = @('psql', 'curl.exe', 'git')
        if ($Rig) { $tools += 'docker' } else { $tools += 'go' }
        foreach ($tool in $tools) {
            if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Stop-Setup "$tool is not on PATH" }
        }
    } -Solution "Install the missing tool, then open a NEW terminal so PATH refreshes. Needed: psql, curl.exe, git, and docker (rig mode) or go (tunnel mode)."

    if ($Rig) {
        Invoke-Step -Name 'Starting the rig and waiting for its database' -Detailed -Action { Start-RigStack } -Solution 'Start Docker Desktop, then re-run with -StartRig. To see why the database is not up: docker compose -f <compose file> logs db'
        Invoke-Step -Name 'Checking database migrations' -Detailed -Action { Confirm-Migrations } -Solution 'Re-run with -ApplyMigrations (needs the golang-migrate CLI), or recreate the rig volume so it rebuilds from audit\docker\schema.sql.'
        Invoke-Step -Name 'Waiting for the rig backend and the Paystack stub' -Detailed -Action { Wait-Backend; Wait-Stub } -Solution 'docker compose -f <compose file> logs backend (or stub). Common causes: a startup crash, missing RSA keys, the database not ready.'
    }
    else {
        Invoke-Step -Name 'Checking the database is migrated' -Action { Confirm-LedgerTable } -Solution 'Apply the migrations to the database in AUDIT_DB_URL and make sure it is the database the backend uses. (The order tables themselves are checked by ORD-S1.)'
        Invoke-Step -Name "Building and starting the Go backend on port $Port" -Action { Start-Backend } -Solution "Run 'go version', make sure 'go build' compiles in backend\, and free the port or pass -ReuseBackend."
        Invoke-Step -Name "Starting the ngrok tunnel to port $Port" -Action { Start-Tunnel } -Solution "Run 'ngrok config check' and make sure no other ngrok session uses $NgrokDomain."
    }

    Invoke-Step -Name 'Checking the backend is reachable' -Detailed -Action { Test-OrdBackendReachable $Ctx } -Solution 'Rig: docker compose -f <compose file> logs backend. Tunnel: confirm ngrok forwards to the backend port and the backend is running.'
    Invoke-Step -Name 'Preparing ORD fixtures (AUDIT-ORD events and tiers)' -Detailed -Action { Initialize-OrdFixtures $Ctx } -Solution 'Check audit\sql\ord_seed.sql against the schema (psql output above), and that AUDIT_VENDOR_EMAIL exists in this database.'
    Invoke-Step -Name 'Opening the organizer, buyer and guest sessions' -Detailed -Action { New-OrdSessions $Ctx } -Solution "Check -LoginPath ($LoginPath), AUDIT_VENDOR_EMAIL / AUDIT_VENDOR_PASSWORD, and the CSRF cookie and header names."

    if ($SetupOnly) {
        Write-Host "`nSetup OK: environment, backend, fixtures and sessions all work. Run again without -SetupOnly." -ForegroundColor Green
    }
    else {
        Write-Host "`n=== ORD checks ===" -ForegroundColor Cyan
        Invoke-Step -Name 'Schema parity and data integrity (ORD-S)' -Detailed -Action { Test-OrdSchema $Ctx } -Solution $CheckCrashSolution
    }
}
catch {
    if (-not $script:StepFailureReported) { Write-Host ("`n" + $_.Exception.Message) -ForegroundColor Red }
    $exitCode = 2
    $KeepTmp = $true
}
finally {
    if (@($Results | Where-Object { $_.Outcome -eq 'FAIL' }).Count -gt 0) { $KeepTmp = $true }
    foreach ($p in $Started) { try { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force } } catch { } }
    if ((-not $KeepTmp) -and (Test-Path $Tmp)) { Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue }
    elseif (Test-Path $Tmp) { Write-Host "Logs kept in $Tmp" -ForegroundColor DarkGray }
}

if ((-not $SetupOnly) -and ($Results.Count -gt 0)) { Write-OrdReport }

$failed = @($Results | Where-Object { $_.Outcome -eq 'FAIL' }).Count
$counts = $Results | Group-Object Outcome | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host ("`nSummary: " + ($counts -join '   ')) -ForegroundColor Cyan
if (($exitCode -eq 0) -and ($failed -gt 0)) { $exitCode = 1 }
exit $exitCode
