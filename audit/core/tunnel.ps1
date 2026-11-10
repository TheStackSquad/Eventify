# audit/core/tunnel.ps1

# core/tunnel.ps1 : tunnel mode. It uses only the rig's database container; the orchestrator starts the backend and ngrok.

function Get-AuditDbName { (($env:AUDIT_DB_URL -split '\?')[0] -split '/')[-1] }

function Invoke-AuditReset {
    Write-Host "Resetting the audit vendors' payments, plans and stored webhooks..." -ForegroundColor Yellow
    $sql = @'
DELETE FROM subscription_payments WHERE vendor_id IN (SELECT v.id FROM vendors v JOIN users u ON u.id = v.owner_id WHERE u.email LIKE 'audit_vendor%');
DELETE FROM subscriptions WHERE vendor_id IN (SELECT v.id FROM vendors v JOIN users u ON u.id = v.owner_id WHERE u.email LIKE 'audit_vendor%');
UPDATE vendors SET subscription_tier = 'free' WHERE email LIKE 'audit_vendor%';
DELETE FROM webhook_inbox;
'@
    psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q -c $sql 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Reset failed' }
}

function Start-TunnelDatabase($Paths, $Reset) {
    Write-Host 'Starting Docker database container...' -ForegroundColor Cyan
    docker compose -f 'audit/docker/docker-compose.loadtest.yml' up -d db 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'docker compose failed' }
    $port = ([uri]($env:AUDIT_DB_URL -replace '^postgres(ql)?://', 'http://')).Port
    $ready = $false
    for ($i = 1; $i -le 15 -and -not $ready; $i++) {
        try { $s = New-Object System.Net.Sockets.TcpClient('127.0.0.1', $port); $s.Close(); $ready = $true }
        catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ready) { throw "The database did not start on port $port" }
    Start-Sleep -Seconds 3   # let Postgres finish its post-init restart
    Write-Host 'Applying database migrations...' -ForegroundColor Cyan
    Push-Location $Paths.Backend
    try { migrate -path migrations -database $env:AUDIT_DB_URL up 2>&1 | Out-Host; $code = $LASTEXITCODE } finally { Pop-Location }
    if ($code -ne 0) { throw 'migrations failed (see the message above)' }
    if ($Reset) { Invoke-AuditReset }
}

function Set-DbTimezone([string]$Zone) {
    if ($Zone -notmatch '^[A-Za-z0-9_+\-/]+$') { throw "Not a valid time zone name: $Zone" }
    psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q -c "ALTER DATABASE `"$(Get-AuditDbName)`" SET timezone = '$Zone'" 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw "Could not set the database time zone to $Zone" }
    Write-Host "Database time zone set to $Zone for this run (restored afterwards)." -ForegroundColor Yellow
}

function Clear-DbTimezone {
    psql $env:AUDIT_DB_URL -q -c "ALTER DATABASE `"$(Get-AuditDbName)`" RESET timezone" 2>&1 | Out-Host
    Write-Host 'Database time zone restored.' -ForegroundColor Yellow
}

# function Invoke-TunnelRun($Paths, [hashtable]$Orch, [hashtable]$Opt) {
#     if ($Opt.Up) {
#         Invoke-Doctor $Paths 'tunnel' $Opt.ComposeFile $Opt.EnvFile
#         if ((Show-Checks) -gt 0) { Write-Host 'Fix the failures above, then run -Up again.' -ForegroundColor Red; return 2 }
#         Start-TunnelDatabase $Paths $Opt.Reset
#         Write-Host 'The rig database is ready and migrated. Run without -Up to start the matrix.' -ForegroundColor Green
#         return 0
#     }
#     $ids = @(Select-Suites $Opt.Suite $Opt.Tag $Opt.All 'tunnel')
#     if (-not $ids.Count) { return 2 }
#     Start-TunnelDatabase $Paths $Opt.Reset
#     $zone = [string]$Opt.DbTimezone
#     try {
#         if ($zone) { Set-DbTimezone $zone }
#         $note = if ($zone) { ", database zone $zone" } else { '' }
#         Write-Host ('Running: {0} (tunnel mode{1})' -f ($ids -join ', '), $note) -ForegroundColor Cyan
#         return (Invoke-Orchestrator $Paths $Orch)
#     }
#     finally { if ($zone) { Clear-DbTimezone } }
# }