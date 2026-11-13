# audit/core/rig.ps1

# core/rig.ps1 : rig mode. The database time zone for one run (with the backend restarted so it picks it up), and the rig runner.

function Get-RigBackendUrl([string]$Compose) {
    $hit = @(Get-StackPorts (Get-ComposeConfig $Compose) | Where-Object { $_.Service -eq 'backend' -and $_.Target -eq 8081 }) | Select-Object -First 1
    return ('http://localhost:{0}' -f $(if ($hit) { $hit.Port } else { 8081 }))
}

function Wait-HttpOk([string]$Url, [int]$TimeoutSec = 90) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try { Invoke-RestMethod -Uri $Url -TimeoutSec 3 | Out-Null; return $true } catch { Start-Sleep -Seconds 2 }
    }
    return $false
}

function Invoke-RigPsql([string]$Compose, [string]$Sql) {
    docker compose -f $Compose exec -T db psql -U loadtest -d eventify_loadtest -v ON_ERROR_STOP=1 -q -c $Sql 2>&1 | Out-Host
    return $LASTEXITCODE
}

function Set-RigDbTimezone([string]$Compose, [string]$Zone) {
    if ($Zone -notmatch '^[A-Za-z0-9_+\-/]+$') { throw "Not a valid time zone name: $Zone" }
    if ((Invoke-RigPsql $Compose "ALTER DATABASE eventify_loadtest SET timezone = '$Zone'") -ne 0) { throw "Could not set the database time zone to $Zone" }
    docker compose -f $Compose restart backend 2>&1 | Out-Host
    if (-not (Wait-HttpOk ((Get-RigBackendUrl $Compose) + '/health'))) { throw 'The backend did not come back after the restart' }
    Write-Host "Rig database time zone set to $Zone for this run (restored afterwards)." -ForegroundColor Yellow
}

function Clear-RigDbTimezone([string]$Compose) {
    $null = Invoke-RigPsql $Compose 'ALTER DATABASE eventify_loadtest RESET timezone'
    docker compose -f $Compose restart backend 2>&1 | Out-Host
    $null = Wait-HttpOk ((Get-RigBackendUrl $Compose) + '/health')
    Write-Host 'Rig database time zone restored.' -ForegroundColor Yellow
}

function Invoke-RigSuites($Paths, $Suites, [hashtable]$Options, [hashtable]$Opt) {
    $zone = [string]$Opt.DbTimezone
    $compose = [string]$Options.ComposeFile
    try {
        if ($zone) { Set-RigDbTimezone $compose $zone }
        if ($Opt.Reset -and (Get-Setting 'AUDIT_DB_URL') -and (@($Suites | ForEach-Object { $_.Id }) -contains 'SUB')) { Invoke-AuditReset }
        return (Invoke-Suites $Paths $Suites $Options)
    }
    finally { if ($zone) { Clear-RigDbTimezone $compose } }
}