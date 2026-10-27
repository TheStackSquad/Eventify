# audit/core/stack.ps1

# core/stack.ps1 : docker compose helpers. Read-only except Stop-Stack.
function Get-ComposeConfig([string]$File) {
    $json = docker compose -f $File config --format json 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) { return $null }
    ($json -join "`n") | ConvertFrom-Json
}

function Get-StackPorts($Cfg) {
    foreach ($svc in $Cfg.services.PSObject.Properties) {
        foreach ($p in @($svc.Value.ports)) {
            if ($p -and $p.published) { [pscustomobject]@{ Service = $svc.Name; Port = [int]$p.published; Target = [int]$p.target } }
        }
    }
}

# Names of the environment variables a service really has (non-empty). Values are never read out.
function Get-EnvKeys($Cfg, [string]$Service) {
    $e = $Cfg.services.$Service.environment
    if (-not $e) { return @() }
    @($e.PSObject.Properties | Where-Object { "$($_.Value)" -ne '' } | ForEach-Object { $_.Name })
}

function Test-StackRunning([string]$File) {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { return $false }
    $ids = docker compose -f $File ps --status running -q 2>$null
    return [bool]$ids
}

function Stop-Stack([string]$Mode, [string]$File) {
    if ($Mode -ne 'rig') { Write-Host 'Tunnel mode: nothing to stop. The backend and tunnel stop at the end of every run.'; return 0 }
    docker compose -f $File down --remove-orphans 2>&1 | Out-Host
    return $LASTEXITCODE
}