# audit/runner/run-matrix.ps1

#   -the only door into the audit suite.
#   -Doctor               check tools, env, ports, docker, health (changes nothing)
#   -Up                   doctor, then build, start, migrate and log in (setup only)
#   -Suite SUB            run chosen suites (-Tag money|fast, or -All; no filter = all)
#   -Down                 stop the rig
#   -Mode tunnel -Manual  real Paystack test payments
# Exit codes: 0 all good, 1 a check failed, 2 a step failed.
[CmdletBinding()]
param(
    [ValidateSet('rig', 'tunnel')][string]$Mode = 'rig',
    [string]$ComposeFile = 'audit/docker/docker-compose.loadtest.yml',
    [string[]]$Suite = @(), [string[]]$Tag = @(),
    [switch]$All, [switch]$Doctor, [switch]$Up, [switch]$Down, [switch]$Report,
    [switch]$Manual, [int]$Burst = 0, [switch]$SetupOnly, [switch]$StartRig,
    [switch]$ApplyMigrations, [switch]$ReuseBackend,
    [string]$EnvFile = '', [string]$LoginPath = '/auth/login',
    [string]$CsrfCookie = 'csrf_token', [string]$CsrfHeader = 'X-CSRF-Token'
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
foreach ($f in 'paths', 'ui', 'env', 'tools', 'ports', 'stack', 'doctor', 'doctor-mode', 'launch') {
    . (Join-Path $Core "$f.ps1")
}
$Paths = Get-AuditPaths $PSScriptRoot
Set-Location $Paths.Repo
$Suite = @($Suite | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
$Tag = @($Tag | ForEach-Object { $_ -split ',' } | Where-Object { $_ })
if ($EnvFile) { Write-Host ('Loaded {0} variables from {1}' -f (Import-AuditEnvFile $EnvFile), $EnvFile) }

if ($Doctor) { Invoke-Doctor $Paths $Mode $ComposeFile; exit $(if ((Show-Checks) -gt 0) { 1 } else { 0 }) }
if ($Down)   { exit (Stop-Stack $Mode $ComposeFile) }
if ($Report) { Write-Host 'Report rebuild arrives in phase P5. Every run still writes audit/results/ by itself.'; exit 0 }

$orch = @{
    Mode = $Mode; ComposeFile = $ComposeFile; LoginPath = $LoginPath; CsrfCookie = $CsrfCookie
    CsrfHeader = $CsrfHeader; Manual = $Manual; Burst = $Burst; ReuseBackend = $ReuseBackend
    ApplyMigrations = $ApplyMigrations; StartRig = $StartRig; SetupOnly = $SetupOnly
}
if ($Up) {
    Invoke-Doctor $Paths $Mode $ComposeFile
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