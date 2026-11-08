#Requires -Version 7.0
# audit/runner/run-orders.ps1 : launcher for the ORD suite (orders, payments, tickets).
#   pwsh -NoProfile -File audit\runner\run-orders.ps1 -Mode rig -SetupOnly      rig already running: setup only
#   pwsh -NoProfile -File audit\runner\run-orders.ps1 -Mode rig -Up             build and start the rig, migrate, then run
#   pwsh -NoProfile -File audit\runner\run-orders.ps1 -Mode rig -Reset          clean ORD data first (ORD rows only)
#   pwsh -NoProfile -File audit\runner\run-orders.ps1 -Mode tunnel [-Manual]    local backend + ngrok + real Paystack test mode
# One run at a time: holds audit\results\.run.lock. -Force removes a lock whose owner is gone.
# Exit codes: 0 all good, 1 a check failed, 2 a step failed.
[CmdletBinding()]
param(
    [ValidateSet('rig', 'tunnel')][string]$Mode = 'rig',
    [string]$ComposeFile = 'audit/docker/docker-compose.loadtest.yml',
    [string]$EnvFile = '',
    [string]$DbTimezone = '',
    [switch]$Up, [switch]$StartRig, [switch]$ApplyMigrations, [switch]$ReuseBackend,
    [switch]$SetupOnly, [switch]$Manual, [switch]$Reset, [switch]$Force,
    [int]$Burst = 0
)
$ErrorActionPreference = 'Stop'

$Core = Join-Path $PSScriptRoot '..\core'
foreach ($f in 'paths', 'config', 'tunnel') { . (Join-Path $Core "$f.ps1") }
$Paths = Get-AuditPaths $PSScriptRoot
Set-Location $Paths.Repo
$null = Initialize-AuditConfig $Mode $EnvFile

# ---------------------------------------------------------------- run lock (same JSON as the shared lock: suite, pid, mode, started)
# When core\lock.ps1 lands, replace these two functions with its Enter-RunLock / Exit-RunLock.
function Enter-OrdLock([string]$File, [string]$LockMode, [switch]$Force) {
    $dir = Split-Path -Parent $File
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    if (Test-Path -LiteralPath $File) {
        $stale = $false; $info = $null
        try { $info = Get-Content -Raw -LiteralPath $File | ConvertFrom-Json } catch { $stale = $true }
        if ($info) {
            $alive = [bool](Get-Process -Id ([int]$info.pid) -ErrorAction SilentlyContinue)
            $age = (Get-Date) - [datetime]$info.started
            if ((-not $alive) -or ($age.TotalHours -gt 4)) { $stale = $true }
        }
        if ($stale -or $Force) { Remove-Item -LiteralPath $File -Force }
        else { throw ("Another audit run holds the lock: suite {0}, mode {1}, pid {2}, since {3}. Wait for it to finish, or pass -Force if that run is dead." -f $info.suite, $info.mode, $info.pid, $info.started) }
    }
    $json = @{ suite = 'ORD'; pid = $PID; mode = $LockMode; started = (Get-Date).ToString('o') } | ConvertTo-Json -Compress
    try { $fs = [IO.File]::Open($File, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None) }
    catch { throw 'Lost a race for the run lock: another run has just started.' }
    try { $bytes = [Text.Encoding]::UTF8.GetBytes($json); $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
}
function Exit-OrdLock([string]$File) { Remove-Item -LiteralPath $File -Force -ErrorAction SilentlyContinue }

$lockFile = Join-Path $Paths.Results '.run.lock'
Enter-OrdLock $lockFile $Mode -Force:$Force
$code = 2
$tzSet = $false
try {
    if ($Mode -eq 'tunnel') { Start-TunnelDatabase $Paths $false }   # ORD does its own scoped reset; never SUB's
    if ($DbTimezone) {
        if ($env:AUDIT_DB_URL) { Set-DbTimezone $DbTimezone; $tzSet = $true }
        else { Write-Host '-DbTimezone ignored: AUDIT_DB_URL is not set (rig mode reads it from the compose file).' -ForegroundColor Yellow }
    }

    $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Paths.Audit 'suites\ord\orchestrate-ord.ps1'), '-Mode', $Mode)
    if ($Mode -eq 'rig') { $argv += @('-ComposeFile', $ComposeFile) }
    if ($Up) { $StartRig = [switch]$true; $ApplyMigrations = [switch]$true }
    if ($Mode -eq 'rig' -and $StartRig) { $argv += '-StartRig' }
    if ($ApplyMigrations) { $argv += '-ApplyMigrations' }
    if ($ReuseBackend) { $argv += '-ReuseBackend' }
    if ($SetupOnly) { $argv += '-SetupOnly' }
    if ($Manual) { $argv += '-Manual' }
    if ($Reset) { $argv += '-Reset' }
    if ($Burst -gt 0) { $argv += @('-Burst', "$Burst") }

    & (Get-Process -Id $PID).Path @argv
    $code = $LASTEXITCODE
}
finally {
    if ($tzSet) { Clear-DbTimezone }
    Exit-OrdLock $lockFile
}
exit $code
