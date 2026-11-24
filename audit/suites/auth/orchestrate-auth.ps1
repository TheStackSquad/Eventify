# audit/suites/auth/orchestrate-auth.ps1
<#
.SYNOPSIS
  AUTH suite orchestrator: sign-up, login, cookies, CSRF and tokens.
  Builds the backend from the working tree and talks to the rig database. No ngrok, no Paystack, no stub.
  Exit codes: 0 all good, 1 a check failed, 2 a step failed.
#>
[CmdletBinding()]
param(
    [ValidateSet('rig', 'tunnel')][string]$Mode = 'tunnel',
    [string]$LoginPath = '/auth/login',
    [string]$CsrfCookie = 'csrf_token',
    [string]$CsrfHeader = 'X-CSRF-Token',
    [switch]$SetupOnly,
    [switch]$ReuseBackend,
    [switch]$Reset
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ($Mode -ne 'tunnel') { Write-Host 'AUTH runs in tunnel mode for now (local backend, rig database).' -ForegroundColor Red; exit 2 }

$RepoRoot = $PSScriptRoot
while (-not (Test-Path -LiteralPath (Join-Path $RepoRoot 'backend'))) {
    $parent = Split-Path -Parent $RepoRoot
    if ((-not $parent) -or ($parent -eq $RepoRoot)) { Write-Host "Could not find the repo root above $PSScriptRoot" -ForegroundColor Red; exit 2 }
    $RepoRoot = $parent
}
$AuditDir    = Join-Path $RepoRoot 'audit'
$BackendDir  = Join-Path $RepoRoot 'backend'
$ResultsDir  = Join-Path $AuditDir 'results'
$Rig         = $false
$ComposePath = ''
$Port = 8081
if ($env:BACKEND_PORT -match '^\d+$') { $Port = [int]$env:BACKEND_PORT }
$NgrokDomain = ''
$Price   = @{}
$Results = New-Object System.Collections.Generic.List[object]
$Started = @()
$KeepTmp = $false
$RunInfo = @{ BackendReused = $false; Tunnel = 'none (local backend, no tunnel)'; Manual = $false; PaystackMode = 'not used by this suite'; StubBase = ''; WorkerInterval = '' }
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ('eventify-auth-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $Tmp | Out-Null
$Ctx = @{ User = $null }
$script:StepFailureReported = $false

foreach ($file in 'error\error-helpers.ps1', 'matrix\helpers.ps1', 'matrix\setup.ps1', 'matrix\report.ps1',
                  'suites\auth\auth-helpers.ps1', 'suites\auth\checks-account.ps1', 'suites\auth\checks-session.ps1', 'suites\auth\checks-lockout.ps1', 'suites\auth\hints-auth.ps1') {
    $path = Join-Path $AuditDir $file
    if (-not (Test-Path -LiteralPath $path)) { Write-Host "Missing helper file: $path" -ForegroundColor Red; Remove-Item -Recurse -Force $Tmp -ErrorAction SilentlyContinue; exit 2 }
    . $path
}
Set-Endpoints

$exitCode = 0
try {
    Write-Host '=== Setup ===' -ForegroundColor Cyan
    Invoke-Step -Name 'Validating environment variables and safety rules' -Action { Assert-Safety } -Solution 'Run through the door (audit/runner/run-matrix.ps1); it loads audit/docker/.env.'
    Invoke-Step -Name 'Checking required tools are on PATH' -Action {
        foreach ($tool in 'psql', 'curl.exe', 'go') { if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { Stop-Setup "$tool is not on PATH" } }
    } -Solution 'Install the missing tool and open a new terminal.'
    Invoke-Step -Name 'Checking the auth tables exist' -Action { Confirm-AuthTables } -Solution 'Start the rig database and apply migrations: run-matrix.ps1 -Mode tunnel -Up'
    Invoke-Step -Name 'Removing the audit_auth accounts of earlier runs' -Action { Clear-AuthAccounts } -Solution 'AUDIT_DB_URL must point at the localhost rig database.'
    Invoke-Step -Name "Building and starting the Go backend on port $Port" -Action { Start-Backend } -Solution 'Run go build in backend/. If the port is busy, stop the other backend (docker compose stop backend) or pass -ReuseBackend.'
    Invoke-Step -Name 'Checking the backend answers' -Action { Test-AuthBackendUp } -Solution 'See the backend logs in the temp folder printed below.'

    if ($SetupOnly) { Write-Host "`nSetup OK. Run again without -SetupOnly." -ForegroundColor Green }
    else {
        Write-Host "`n=== Automated checks ===" -ForegroundColor Cyan
        Invoke-AuthGroup 'Schema (AUTH-S)'              { Test-AuthSchema }
        Invoke-AuthGroup 'Sign-up (AUTH-A)'             { Test-AuthSignup }
        Invoke-AuthGroup 'Login (AUTH-L)'               { Test-AuthLogin }
        Invoke-AuthGroup 'Cookies and CSRF (AUTH-C)'    { Test-AuthCookies }
        Invoke-AuthGroup 'Tokens and sessions (AUTH-T)' { Test-AuthTokens }
        Invoke-AuthGroup 'Lockout and login timing (AUTH-K, AUTH-L)' { Test-AuthLockout }
        Invoke-AuthGroup 'Edge: health and CORS (AUTH-E)' { Test-AuthEdge }
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

if ((-not $SetupOnly) -and ($Results.Count -gt 0)) {
    Write-Report -Claims (Get-AuthClaims) -HintsMap $AuthHints -Prefix 'auth' -Title 'Authentication and sessions' -SuiteId 'AUTH' -Limits (Get-AuthLimits)
}
$failed = @($Results | Where-Object { $_.Outcome -eq 'FAIL' }).Count
$counts = $Results | Group-Object Outcome | ForEach-Object { "$($_.Name)=$($_.Count)" }
Write-Host ("`nSummary: " + ($counts -join '   ')) -ForegroundColor Cyan
if (($exitCode -eq 0) -and ($failed -gt 0)) { $exitCode = 1 }
exit $exitCode
