# audit/runner/run-matrix.ps1

#   -the only door into the audit suite.
#   -Doctor                 check tools, env, ports, docker, health (changes nothing)
#   -Up                     doctor, then build, start, migrate and log in (setup only)
#   -Suite SUB              run chosen suites (-Tag money|fast, or -All; no filter = all)
#   -Down                   stop the rig
#   -Mode tunnel -Manual    real Paystack test payments
# Exit codes: 0 all good, 1 a check failed, 2 a step failed.
[CmdletBinding()]
param(
    [ValidateSet('rig', 'tunnel')][string]$Mode = 'rig',
    [switch]$ShowConfig,
    [string]$ComposeFile = 'audit/docker/docker-compose.loadtest.yml',
    [string[]]$Suite = @(), [string[]]$Tag = @(),
    [switch]$All, [switch]$Doctor, [switch]$Up, [switch]$Down, [switch]$Report,
    [switch]$Manual, [int]$Burst = 0, [switch]$SetupOnly, [switch]$StartRig,
    [switch]$ApplyMigrations, [switch]$ReuseBackend,
    [string]$EnvFile = '', [string]$LoginPath = '/auth/login',
    [string]$CsrfCookie = 'csrf_token', [string]$CsrfHeader = 'X-CSRF-Token',
    [string]$DbTimezone = '', [switch]$Reset
)
$ErrorActionPreference = 'Stop'

# Everything below needs PowerShell 7. From Windows PowerShell 5.1, restart in pwsh.
if ($PSVersionTable.PSVersion.Major -lt 7) {
    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if (-not $pwsh) { Write-Host 'PowerShell 7 is required: winget install --id Microsoft.PowerShell' -ForegroundColor Red; exit 2 }
    $relaunch = foreach ($k in $PSBoundParameters.Keys) {
        $v = $PSBoundParameters[$k]
        if ($v -is [switch]) { if ($v.IsPresent) { "-$k" } }
        elseif ($v -is [array]) { "-$k"; ($v -join ',') }
        else { "-$k"; "$v" }
    }
    & $pwsh.Source -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath @relaunch
    exit $LASTEXITCODE
}

$Core = Join-Path $PSScriptRoot '../core'
foreach ($f in 'paths', 'ui', 'config', 'tools', 'ports', 'stack', 'doctor', 'doctor-mode', 'launch', 'tunnel') {
    . (Join-Path $Core "$f.ps1")
}
$Paths = Get-AuditPaths $PSScriptRoot
Set-Location $Paths.Repo
$Suite = @($Suite | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$Tag = @($Tag | ForEach-Object { $_ -split ',' } | Where-Object { $_ })

if ($Doctor) { Invoke-Doctor $Paths $Mode $ComposeFile $EnvFile; exit $(if ((Show-Checks) -gt 0) { 1 } else { 0 }) }
if ($Down)   { exit (Stop-Stack $Mode $ComposeFile) }
if ($Report) { Write-Host 'Report rebuild arrives in phase P5. Every run still writes audit/results/ by itself.'; exit 0 }
if ($ShowConfig) { Show-AuditConfig (Import-AuditConfig -Mode $Mode -EnvFile $EnvFile); exit 0 }

$null = Initialize-AuditConfig $Mode $EnvFile

$orch = @{
    Mode = $Mode; ComposeFile = $ComposeFile; LoginPath = $LoginPath; CsrfCookie = $CsrfCookie
    CsrfHeader = $CsrfHeader; Manual = $Manual; Burst = $Burst; ReuseBackend = $ReuseBackend
    ApplyMigrations = $ApplyMigrations; StartRig = $StartRig; SetupOnly = $SetupOnly; Reset = $Reset
}

if ($Mode -eq 'tunnel') {
    $orch.Port = [int](Get-Setting 'BACKEND_PORT')
    $orch.NgrokDomain = Get-Setting 'NGROK_DOMAIN'
    exit (Invoke-TunnelRun $Paths $orch @{ Up = $Up; Reset = $Reset; DbTimezone = $DbTimezone; Suite = $Suite; Tag = $Tag; All = $All; EnvFile = $EnvFile; ComposeFile = $ComposeFile })
}

if ($Up) {
    Invoke-Doctor $Paths $Mode $ComposeFile $EnvFile
    if ((Show-Checks) -gt 0) { Write-Host 'Fix the failures above, then run -Up again.' -ForegroundColor Red; exit 2 }
    $orch.StartRig = $true; $orch.ApplyMigrations = $true; $orch.SetupOnly = $true
    exit (Invoke-Orchestrator $Paths $orch)
}

$ids = @(Select-Suites $Suite $Tag $All $Mode)
if (-not $ids.Count) { exit 2 }
if (($Mode -eq 'rig') -and -not $StartRig -and -not (Test-StackRunning $ComposeFile)) {
    Write-Host 'The rig is not running. Start it with -Up.' -ForegroundColor Red; exit 2
}
Write-Host ('Running: {0} ({1} mode)' -f ($ids -join ', '), $Mode) -ForegroundColor Cyan
exit (Invoke-Orchestrator $Paths $orch)