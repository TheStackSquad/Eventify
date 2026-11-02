# audit/ runner/ run-orchestrator.ps1

# ============================================================================
# Audit Orchestrator Wrapper
# ============================================================================

# audit/runner/run-ochestrator.ps1 : tunnel-mode launcher. Starts only the rig database, then runs the matrix.
#   .\audit\runner\run-ochestrator.ps1               automated checks
#   .\audit\runner\run-ochestrator.ps1 -Manual       adds the real Paystack test payments (T1, T2, T5)
# param(
#     [switch]$Manual,
#     [switch]$ReuseBackend,
#     [switch]$SetupOnly,
#     [int]$Burst = 0
# )
# $ErrorActionPreference = 'Stop'
# Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path


# . (Join-Path $PSScriptRoot '../core/env.ps1')
# Remove-Item Env:PAYSTACK_SECRET_KEY -ErrorAction SilentlyContinue        # Prevent stale session values from winning
# $null = Import-AuditEnvFile (Join-Path $PSScriptRoot '../docker/.env')    # Load logins, Paystack test key, and FRONTEND_URL securely
# $env:AUDIT_DB_URL = 'postgres://loadtest:loadtest@127.0.0.1:55432/eventify_loadtest?sslmode=disable'   # Throwaway local rig database
# $env:POSTGRES_URI = $env:AUDIT_DB_URL

# Write-Host "Starting Docker database container..." -ForegroundColor Cyan
# docker compose -f audit/docker/docker-compose.loadtest.yml up -d db

# Write-Host "Waiting for PostgreSQL to accept connections on port 55432..." -ForegroundColor Yellow
# $maxRetries = 15
# $retryCount = 0
# $connected = $false

# while ($retryCount -lt $maxRetries) {
#     try {
#         $socket = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 55432)
#         if ($socket.Connected) {
#             $socket.Close()
#             $connected = $true
#             break
#         }
#     } catch {
#         Start-Sleep -Seconds 2
#         $retryCount++
#         Write-Host "   Attempt $retryCount/$maxRetries waiting for database..." -ForegroundColor DarkYellow
#     }
# }

# if (-not $connected) {
#     Write-Host "Error: Database failed to start on port 55432." -ForegroundColor Red
#     exit 1
# }

# Write-Host "Database is online and accepting connections!" -ForegroundColor Green

# Write-Host "Waiting 3 seconds for database engine to fully stabilize..." -ForegroundColor Yellow
# Start-Sleep -Seconds 3

# Write-Host "Applying database migrations..." -ForegroundColor Cyan
# Set-Location backend
# migrate -path migrations -database $env:AUDIT_DB_URL up
# Set-Location ..

# # Run the core orchestrator
# .\audit\core\orchestrate.ps1




# audit/runner/run-ochestrator.ps1 : tunnel-mode launcher. Starts only the rig database, then runs the matrix.
#   .\audit\runner\run-ochestrator.ps1               automated checks
#   .\audit\runner\run-ochestrator.ps1 -Manual       adds the real Paystack test payments (T1, T2, T5)
param(
    [switch]$Manual,
    [switch]$ReuseBackend,
    [switch]$SetupOnly,
    [int]$Burst = 0
)
$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

. (Join-Path $PSScriptRoot '..\core\env.ps1')
$null = Import-AuditEnvFile (Join-Path $PSScriptRoot '..\docker\.env')   # vendor logins, Paystack test key, FRONTEND_URL
$env:AUDIT_DB_URL = 'postgres://loadtest:loadtest@127.0.0.1:55432/eventify_loadtest?sslmode=disable'   # throwaway local rig database
$env:POSTGRES_URI = $env:AUDIT_DB_URL

Write-Host 'Starting Docker database container...' -ForegroundColor Cyan
docker compose -f audit/docker/docker-compose.loadtest.yml up -d db
if ($LASTEXITCODE -ne 0) { throw 'docker compose failed' }

Write-Host 'Waiting for PostgreSQL on port 55432...' -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 15 -and -not $ready; $i++) {
    try { $s = New-Object System.Net.Sockets.TcpClient('127.0.0.1', 55432); $s.Close(); $ready = $true }
    catch { Start-Sleep -Seconds 2 }
}
if (-not $ready) { Write-Host 'Database did not start on port 55432.' -ForegroundColor Red; exit 1 }
Start-Sleep -Seconds 3   # let Postgres finish its post-init restart

Write-Host 'Applying database migrations...' -ForegroundColor Cyan
Push-Location backend
migrate -path migrations -database $env:AUDIT_DB_URL up
Pop-Location

$run = @{ Manual = $Manual; ReuseBackend = $ReuseBackend; SetupOnly = $SetupOnly }
if ($Burst -gt 0) { $run.Burst = $Burst }
& (Join-Path $PSScriptRoot '..\core\orchestrate.ps1') @run
exit $LASTEXITCODE