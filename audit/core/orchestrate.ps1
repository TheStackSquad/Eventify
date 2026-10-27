# audit/rig/run-ngrok-matrix.ps1

<#
.SYNOPSIS
  Subscription payment and webhook matrix. Two modes:
    * Tunnel mode (default): local backend + ngrok + real Paystack test mode.
    * Rig mode (-ComposeFile): reads its settings from the docker-compose load-test rig
      (database, backend port, Paystack stub, signing key) and needs no ngrok.

.DESCRIPTION
  Safe by default: refuses non-test Paystack keys and non-local databases, never fabricates
  references, and records every check as PASS / FAIL / SKIP / INFO. Writes an evidence report
  (markdown + json) to audit\results\ with the git commit and a "Next steps" section that maps
  every failed or skipped check to where to look.

  Run -SetupOnly first. It validates the environment, then exits.

  File layout (this script only orchestrates; the logic lives in the helper files):
    audit\error\error-helpers.ps1   Invoke-Step: prints failed step, exact error and solution
    audit\matrix\hints.ps1          "Next steps" hints used by the report
    audit\matrix\helpers.ps1        recording, SQL, HTTP, sessions, webhooks, database state
    audit\matrix\setup.ps1          rig mode, tunnel mode, login, vendors, baseline
    audit\matrix\checks.ps1         the automated checks (T3, T7-T10, T12, T13, T15-T17)
    audit\matrix\manual.ps1         the tests that need a real Paystack test payment (T1, T2, T5)
    audit\matrix\report.ps1         the evidence report
    audit\runner\run-matrix.ps1     one-line launcher

.PARAMETER ComposeFile
  Path to a compose file such as audit\docker\docker-compose.loadtest.yml. Values are read with
  `docker compose config --format json`. Secrets are held in memory only, never printed or saved.

.PARAMETER StartRig
  Runs `docker compose up -d --build` first (rig mode).

.PARAMETER ApplyMigrations
  Applies backend\migrations to the rig database if subscription_payments is missing (needs the
  golang-migrate CLI on PATH).

.PARAMETER Manual
  Tunnel mode only: adds the tests that need a real Paystack test payment (T1, T2, T5).

.PARAMETER Burst
  Fires N initiate calls to observe rate limiting (INFO only).

.EXAMPLE
  # rig mode
  powershell -ExecutionPolicy Bypass -File audit\rig\run-ngrok-matrix.ps1 -ComposeFile audit\docker\docker-compose.loadtest.yml -StartRig -ApplyMigrations -SetupOnly
  powershell -ExecutionPolicy Bypass -File audit\rig\run-ngrok-matrix.ps1 -ComposeFile audit\docker\docker-compose.loadtest.yml

  # tunnel mode
  powershell -ExecutionPolicy Bypass -File audit\rig\run-ngrok-matrix.ps1 -SetupOnly
  powershell -ExecutionPolicy Bypass -File audit\rig\run-ngrok-matrix.ps1 -Manual -Burst 30

  Always required: AUDIT_VENDOR_EMAIL, AUDIT_VENDOR_PASSWORD (a vendor-owner test account).
  Optional: AUDIT_VENDOR2_EMAIL, AUDIT_VENDOR2_PASSWORD (a different vendor; enables T8).
  Tunnel mode also needs: PAYSTACK_SECRET_KEY (sk_test_...), AUDIT_DB_URL (localhost).
  Requires: PowerShell 5.1+, psql, curl.exe, git; go + ngrok (tunnel mode) or docker (rig mode).
#>
[CmdletBinding()]
param(
    [int]$Port = 8080,
    [string]$NgrokDomain = "autopilot-secrecy-scraggly.ngrok-free.dev",
    [string]$ComposeFile = "",
    [string]$LoginPath = "/api/v1/auth/login",   # CONFIRM against router.go
    [string]$CsrfCookie = "csrf_token",          # CONFIRM against the CSRF middleware
    [string]$CsrfHeader = "X-CSRF-Token",        # CONFIRM against the CSRF middleware
    [int]$Burst = 0,
    [switch]$SetupOnly,
    [switch]$Manual,
    [switch]$ReuseBackend,
    [switch]$StartRig,
    [switch]$ApplyMigrations
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------- locate the repo and load the helper files

# Walk up from this script until a folder containing "backend" is found, so the script
# works from audit\rig, audit\ or anywhere else under the repo.
$RepoRoot = $PSScriptRoot
while (-not (Test-Path -LiteralPath (Join-Path $RepoRoot "backend"))) {
    $parent = Split-Path -Parent $RepoRoot
    if ((-not $parent) -or ($parent -eq $RepoRoot)) {
        Write-Host "Could not find the repo root (a folder containing 'backend') above $PSScriptRoot" -ForegroundColor Red
        exit 2
    }
    $RepoRoot = $parent
}
$AuditDir = Join-Path $RepoRoot "audit"

$HelperFiles = @(
    "error\error-helpers.ps1",
    "matrix\hints.ps1",
    "matrix\helpers.ps1",
    "matrix\setup.ps1",
    "matrix\checks.ps1",
    "matrix\manual.ps1",
    "matrix\report.ps1"
)

# ---------------------------------------------------------------- run state (shared with the helper files)

$BackendDir     = Join-Path $RepoRoot "backend"
$ResultsDir     = Join-Path $AuditDir "results"
$Rig            = [bool]$ComposeFile
$ComposePath    = ""
$RigFrontendUrl = $true
$Price          = @{ basic = 350000; premium = 1000000; featured = 2500000 }
$Results        = New-Object System.Collections.Generic.List[object]
$Started        = @()
$KeepTmp        = $false
$RunInfo        = @{
    BackendReused = $false; Tunnel = ""; Manual = [bool]$Manual
    PaystackMode = "test mode (real Paystack)"; StubBase = ""; WorkerInterval = ""
}
$Tmp            = Join-Path ([IO.Path]::GetTempPath()) ("eventify-matrix-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $Tmp | Out-Null

# Values the steps hand to each other (sessions, vendor id, tier to pay for, ...).
$Ctx = @{ Reach = $null; S1 = $null; S2 = $null; Vid = ""; UseTier = "premium" }

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

$CheckCrashSolution = "The check could not run (this is a crash, not a failed test). Usually the database or the backend became unreachable mid-run: confirm both are still up, then re-run."

# ---------------------------------------------------------------- run

$exitCode = 0
try {
    Write-Host "=== Setup ===" -ForegroundColor Cyan

    if ($Rig) {
        Invoke-Step -Name "Reading rig settings from the compose file" -Detailed -Action {
            Get-RigConfig
            Set-Endpoints
        } -Solution "Check the -ComposeFile path, that Docker is running ('docker version'), that Compose v2 is installed ('docker compose version'), that the compose file defines services named db and backend, and that RSA_PRIVATE_KEY / RSA_PUBLIC_KEY are set in audit\docker\.env or your shell."
    }

    Invoke-Step -Name "Validating required environment variables and safety rules" -Action {
        Assert-Safety
    } -Solution "Set the missing variables in this terminal before running: AUDIT_VENDOR_EMAIL and AUDIT_VENDOR_PASSWORD always; in tunnel mode also PAYSTACK_SECRET_KEY (must start with sk_test_) and AUDIT_DB_URL (must point at localhost)."

    Invoke-Step -Name "Checking required tools are on PATH" -Action {
        $tools = @("psql", "curl.exe", "git")
        if ($Rig) { $tools += "docker" } else { $tools += "go" }
        foreach ($tool in $tools) {
            if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Stop-Setup "$tool is not on PATH" }
        }
    } -Solution "Install the missing tool, then open a NEW terminal so PATH refreshes. Needed: psql (PostgreSQL client), curl.exe (ships with Windows 10+), git, and docker (rig mode) or go (tunnel mode). Verify with 'psql --version', 'git --version', 'go version' or 'docker --version'."

    if ($Rig) {
        Invoke-Step -Name "Starting the rig and waiting for its database" -Detailed -Action {
            Start-RigStack
        } -Solution "Start Docker Desktop, then re-run with -StartRig. To see why the database is not up: docker compose -f <compose file> logs db"

        Invoke-Step -Name "Checking database migrations" -Detailed -Action {
            Confirm-Migrations
        } -Solution "Re-run with -ApplyMigrations (needs the golang-migrate CLI on PATH), or regenerate audit\docker\schema.sql so subscription_payments exists."

        Invoke-Step -Name "Waiting for the rig backend to answer" -Detailed -Action {
            Wait-Backend
            Add-RigFrontendNote
        } -Solution "The backend container is not serving. Run: docker compose -f <compose file> logs backend. Common causes: a crash on startup, missing RSA keys, or the database not ready."
    }
    else {
        Invoke-Step -Name "Checking the subscription_payments table exists" -Action {
            Confirm-LedgerTable
        } -Solution "Apply migration 000001 to the database in AUDIT_DB_URL (from the backend folder: migrate -path migrations -database `$env:AUDIT_DB_URL up) and make sure AUDIT_DB_URL points at the same database the backend uses."

        Invoke-Step -Name "Building and starting the Go backend on port $Port" -Action {
            Start-Backend
        } -Solution "Run 'go version' and make sure backend\go.mod exists and 'go build' compiles. If the port is busy, stop that process or pass -ReuseBackend. Make sure the backend reads the PORT variable. Backend logs are in the temp folder printed below."

        Invoke-Step -Name "Starting the ngrok tunnel to port $Port" -Action {
            Start-Tunnel
        } -Solution "Run 'ngrok config check', make sure your ngrok account owns the domain $NgrokDomain, and that no other ngrok session is already using it. The tunnel URL must match the webhook URL saved in the Paystack dashboard."
    }

    Invoke-Step -Name "Checking the backend is reachable" -Detailed -Action {
        Test-BackendReachable $Ctx
    } -Solution "Rig mode: docker compose -f <compose file> logs backend. Tunnel mode: confirm ngrok forwards to port $Port and the backend is running."

    Invoke-Step -Name "Logging in the test vendor accounts" -Detailed -Action {
        New-VendorSessions $Ctx
    } -Solution "Check -LoginPath ($LoginPath) against router.go, the JSON field names the login endpoint expects, that AUDIT_VENDOR_EMAIL / AUDIT_VENDOR_PASSWORD belong to a real account in this database, and -CsrfCookie ($CsrfCookie) / -CsrfHeader ($CsrfHeader) against the CSRF middleware."

    Invoke-Step -Name "Looking up the vendor records" -Action {
        Resolve-Vendors $Ctx
    } -Solution "AUDIT_VENDOR_EMAIL must be the owner of a row in the vendors table (users.id = vendors.owner_id) in this database. If you set vendor 2, it must own a different vendor than vendor 1."

    Invoke-Step -Name "Reading the starting subscription state" -Detailed -Action {
        Get-BaselineState $Ctx
    } -Solution "Check that AUDIT_DB_URL points at the same database as the backend and that the subscriptions table exists. If the Paystack stub could not be reached, check that its compose service publishes its port."

    if ($SetupOnly) {
        Write-Host "`nSetup OK: environment, login and database all work. Run again without -SetupOnly." -ForegroundColor Green
    }
    else {
        Write-Host "`n=== Automated checks ===" -ForegroundColor Cyan

        Invoke-Step -Name "Public plans match the server price table (T13)" -Detailed -Action { Test-PublicPlans $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Authentication and CSRF checks (T12)" -Detailed -Action { Test-AuthAndCsrf $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Input validation checks (T10)" -Detailed -Action { Test-InputValidation $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Unpaid payment, signature and ownership checks (T9, T3, T9b, T8)" -Detailed -Action { Test-UnpaidPaymentFlow $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Unknown reference webhook check (T3c)" -Detailed -Action { Test-UnknownReference $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Oversized webhook body check (T16)" -Detailed -Action { Test-OversizedBody $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Hostile reference checks (T17)" -Detailed -Action { Test-HostileReferences $Ctx } -Solution $CheckCrashSolution
        Invoke-Step -Name "Tier switch while active check (T7)" -Detailed -Action { Test-TierSwitch $Ctx } -Solution $CheckCrashSolution

        if ($Burst -gt 0) {
            Invoke-Step -Name "Rate limit burst of $Burst initiate calls (T15)" -Detailed -Action { Test-RateLimit $Ctx } -Solution $CheckCrashSolution
        }

        if ($Manual) {
            Invoke-Step -Name "Manual payment tests with a Paystack test card (T1, T2, T5)" -Detailed -Action { Invoke-ManualPaymentTests $Ctx } -Solution "A manual test could not finish. Confirm the tunnel is up, the Paystack dashboard webhook URL matches it, and you paid with a Paystack TEST card within 10 minutes."
        }
    }
}
catch {
    # A failed step has already printed its own report; only print unexpected errors.
    if (-not $script:StepFailureReported) { Write-Host ("`n" + $_.Exception.Message) -ForegroundColor Red }
    $exitCode = 2
    $KeepTmp = $true
}
finally {
    foreach ($p in $Started) { try { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force } } catch { } }
    if ((-not $KeepTmp) -and (Test-Path $Tmp)) { Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue }
    elseif (Test-Path $Tmp) { Write-Host "Logs kept in $Tmp" -ForegroundColor DarkGray }
}

if ((-not $SetupOnly) -and ($Results.Count -gt 0)) { Write-Report }

$failed = @($Results | Where-Object { $_.Outcome -eq "FAIL" }).Count
$counts = $Results | Group-Object Outcome | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host ("`nSummary: " + ($counts -join "  ")) -ForegroundColor Cyan
if (($exitCode -eq 0) -and ($failed -gt 0)) { $exitCode = 1 }
exit $exitCode