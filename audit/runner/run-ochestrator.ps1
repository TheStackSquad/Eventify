# audit/runner/run-ochestrator.ps1 : tunnel-mode launcher. Starts only the rig database, then runs the matrix.
#   .\audit\runner\run-ochestrator.ps1                     automated checks
#   .\audit\runner\run-ochestrator.ps1 -Manual             adds the real Paystack test payments (T1, T2, T5)
#   .\audit\runner\run-ochestrator.ps1 -Reset -Manual      clears the audit vendors' payments and plans first (clean evidence)

<#
.SYNOPSIS
    audit/runner/run-ochestrator.ps1 : tunnel-mode launcher. Starts only the rig database, then runs the matrix.
.DESCRIPTION
    .\audit\runner\run-ochestrator.ps1                    automated checks
    .\audit\runner\run-ochestrator.ps1 -Manual            adds the real Paystack test payments (T1, T2, T5)
    .\audit\runner\run-ochestrator.ps1 -Reset -Manual     clears the audit vendors' payments and plans first (clean evidence)
#>
param(
    [switch]$Manual,
    [switch]$Reset,
    [switch]$ReuseBackend,
    [switch]$SetupOnly,
    [int]$Burst = 0
)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

. (Join-Path $PSScriptRoot '..\core\env.ps1')
$envFile = (Resolve-Path (Join-Path $PSScriptRoot '..\docker\.env')).Path
$null = Import-AuditEnvFile $envFile          # vendor logins, Paystack test key, FRONTEND_URL
$env:EVENTIFY_ENV_FILE = $envFile             # the backend reads this file itself; it never looks inside audit/
$env:AUDIT_DB_URL = 'postgres://loadtest:loadtest@127.0.0.1:55432/eventify_loadtest?sslmode=disable'   # throwaway local rig database
$env:POSTGRES_URI = $env:AUDIT_DB_URL
$env:SUBSCRIPTION_WORKER_INTERVAL = '20s'

Write-Host 'Starting Docker database container...' -ForegroundColor Cyan
docker compose -f audit/docker/docker-compose.loadtest.yml up -d db
if ($LASTEXITCODE -ne 0) { throw 'docker compose failed' }

Write-Host 'Waiting for PostgreSQL on port 55432...' -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 15 -and -not $ready; $i++) {
    try { 
        $s = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 55432)
        $s.Close()
        $ready = $true 
    }
    catch { 
        Start-Sleep -Seconds 2 
    }
}
if (-not $ready) { 
    Write-Host 'Database did not start on port 55432.' -ForegroundColor Red
    exit 1 
}
Start-Sleep -Seconds 3   # let Postgres finish its post-init restart

Write-Host 'Applying database migrations...' -ForegroundColor Cyan
Push-Location backend
migrate -path migrations -database $env:AUDIT_DB_URL up
Pop-Location

if ($Reset) {
    Write-Host "Resetting the audit vendors' payments, plans and stored webhooks..." -ForegroundColor Yellow
    $sql = @'
DELETE FROM subscription_payments WHERE vendor_id IN (SELECT v.id FROM vendors v JOIN users u ON u.id = v.owner_id WHERE u.email LIKE 'audit_vendor%');
DELETE FROM subscriptions WHERE vendor_id IN (SELECT v.id FROM vendors v JOIN users u ON u.id = v.owner_id WHERE u.email LIKE 'audit_vendor%');
UPDATE vendors SET subscription_tier = 'free' WHERE email LIKE 'audit_vendor%';
DELETE FROM webhook_inbox;
'@
    psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q -c $sql
    if ($LASTEXITCODE -ne 0) { throw 'Reset failed' }
}

$run = @{
    Manual       = $Manual
    ReuseBackend = $ReuseBackend
    SetupOnly    = $SetupOnly
}

if ($Burst -gt 0) { 
    $run.Burst = $Burst 
}

& (Join-Path $PSScriptRoot '..\core\orchestrate.ps1') @run
exit $LASTEXITCODE