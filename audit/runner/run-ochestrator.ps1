# audit/ runner/ run-orchestrator.ps1

# ============================================================================
# Audit Orchestrator Wrapper
# ============================================================================
. (Join-Path $PSScriptRoot '../core/env.ps1')
Remove-Item Env:PAYSTACK_SECRET_KEY -ErrorAction SilentlyContinue        # Prevent stale session values from winning
$null = Import-AuditEnvFile (Join-Path $PSScriptRoot '../docker/.env')    # Load logins, Paystack test key, and FRONTEND_URL securely
$env:AUDIT_DB_URL = 'postgres://loadtest:loadtest@127.0.0.1:55432/eventify_loadtest?sslmode=disable'   # Throwaway local rig database
$env:POSTGRES_URI = $env:AUDIT_DB_URL

Write-Host "Starting Docker database container..." -ForegroundColor Cyan
docker compose -f audit/docker/docker-compose.loadtest.yml up -d db

Write-Host "Waiting for PostgreSQL to accept connections on port 55432..." -ForegroundColor Yellow
$maxRetries = 15
$retryCount = 0
$connected = $false

while ($retryCount -lt $maxRetries) {
    try {
        $socket = New-Object System.Net.Sockets.TcpClient("127.0.0.1", 55432)
        if ($socket.Connected) {
            $socket.Close()
            $connected = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        $retryCount++
        Write-Host "   Attempt $retryCount/$maxRetries waiting for database..." -ForegroundColor DarkYellow
    }
}

if (-not $connected) {
    Write-Host "Error: Database failed to start on port 55432." -ForegroundColor Red
    exit 1
}

Write-Host "Database is online and accepting connections!" -ForegroundColor Green

Write-Host "Waiting 3 seconds for database engine to fully stabilize..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Applying database migrations..." -ForegroundColor Cyan
Set-Location backend
migrate -path migrations -database $env:AUDIT_DB_URL up
Set-Location ..

# Run the core orchestrator
.\audit\core\orchestrate.ps1