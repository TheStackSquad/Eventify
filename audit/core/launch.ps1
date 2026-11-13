# # audit/core/launch.ps1

# core/launch.ps1 : pick suites from their manifests and run their orchestrators.
# A suite is audit/suites/<id>/suite.psd1 (see core/suites.ps1). Adding a suite never edits this file.

function Get-SelectedSuites($Paths, [string[]]$Names, [string[]]$Tags, [string]$Mode) {
    $all = @(Get-AuditSuites $Paths.Audit)
    foreach ($b in @($all | Where-Object { @($_.Problems).Count })) {
        Write-Host ('Suite {0} is skipped: {1}' -f $b.Id, (@($b.Problems) -join '; ')) -ForegroundColor Yellow
    }
    return @(Select-AuditSuites $all $Names $Tags $Mode)
}

# Kept for old callers: ids only.
function Select-Suites([string[]]$Names, [string[]]$Tags, [bool]$All, [string]$Mode) {
    @(Get-SelectedSuites (Get-AuditPaths $PSScriptRoot) $Names $Tags $Mode | ForEach-Object { $_.Id })
}

function ConvertTo-ArgList([hashtable]$Options) {
    foreach ($k in $Options.Keys) {
        $v = $Options[$k]
        if ($v -is [switch] -or $v -is [bool]) { if ($v) { "-$k" } }
        elseif ($v -is [int]) { if ($v -gt 0) { "-$k"; "$v" } }
        elseif ($v) { "-$k"; "$v" }
    }
}

# Each orchestrator declares its own parameters, so only the options it declares are passed.
function Invoke-SuiteOrchestrator($Paths, $Suite, [hashtable]$Options) {
    $script = [IO.Path]::GetFullPath([IO.Path]::Combine($Paths.Audit, ($Suite.Orchestrator -replace '\\', '/')))
    $cmd = Get-Command -Name $script -ErrorAction SilentlyContinue
    $declared = if ($cmd) { @($cmd.Parameters.Keys) } else { @() }
    $o = @{}
    foreach ($k in $Options.Keys) { if ($declared -contains $k) { $o[$k] = $Options[$k] } }
    if ($Options.Mode -ne 'rig') { $o.Remove('ComposeFile'); $o.Remove('StartRig') }   # the SUB orchestrator treats a compose file as rig mode
    $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + @(ConvertTo-ArgList $o)
    $quoted = $argv | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
    $p = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList $quoted -WorkingDirectory $Paths.Repo -NoNewWindow -Wait -PassThru
    return $p.ExitCode
}

# The SUB setup-only path (-Up) in rig mode.
function Invoke-Orchestrator($Paths, [hashtable]$Options) {
    Invoke-SuiteOrchestrator $Paths ([pscustomobject]@{ Orchestrator = 'core/orchestrate.ps1' }) $Options
}

function Invoke-Suites($Paths, $Suites, [hashtable]$Options) {
    $rows = @(); $worst = 0
    foreach ($s in $Suites) {
        Write-Host ("`n=== Suite {0}: {1} ===" -f $s.Id, $s.Title) -ForegroundColor Cyan
        $code = Invoke-SuiteOrchestrator $Paths $s $Options
        $rows += [pscustomobject]@{ Suite = $s.Id; Exit = $code }
        if ($code -gt $worst) { $worst = $code }
    }
    Write-Host "`nSuite results:" -ForegroundColor Cyan
    foreach ($r in $rows) {
        $word = switch ($r.Exit) { 0 { 'all checks passed' } 1 { 'a check failed' } default { 'a step failed' } }
        Write-Host ('  {0,-6} exit {1}  {2}' -f $r.Suite, $r.Exit, $word) -ForegroundColor $(if ($r.Exit -eq 0) { 'Green' } else { 'Red' })
    }
    return $worst
}

function Invoke-TunnelUp($Paths, [string]$ComposeFile, [string]$EnvFile, [bool]$Reset) {
    Invoke-Doctor $Paths 'tunnel' $ComposeFile $EnvFile
    if ((Show-Checks) -gt 0) { Write-Host 'Fix the failures above, then run -Up again.' -ForegroundColor Red; return 2 }
    Start-TunnelDatabase $Paths $false
    if ($Reset) { Invoke-AuditReset }
    Write-Host 'The rig database is ready and migrated. Run without -Up to start the suites.' -ForegroundColor Green
    return 0
}

# Tunnel mode: only the database container runs here; each orchestrator starts the backend and ngrok itself.
function Invoke-TunnelSuites($Paths, $Suites, [hashtable]$Options, [hashtable]$Opt) {
    Start-TunnelDatabase $Paths $false
    if ($Opt.Reset -and (@($Suites | ForEach-Object { $_.Id }) -contains 'SUB')) { Invoke-AuditReset }
    $zone = [string]$Opt.DbTimezone
    try {
        if ($zone) { Set-DbTimezone $zone }
        return (Invoke-Suites $Paths $Suites $Options)
    }
    finally { if ($zone) { Clear-DbTimezone } }
}











# # core/launch.ps1 : pick suites and start the orchestrator. The suite list moves to config/suites.psd1 in P4.
# $script:KnownSuites = @(
#     @{ Id = 'SUB'; Tags = @('money', 'fast'); Modes = @('rig', 'tunnel') }
# )

# function Select-Suites([string[]]$Names, [string[]]$Tags, [bool]$All, [string]$Mode) {
#     $pool = @($script:KnownSuites | Where-Object { $_.Modes -contains $Mode })
#     if ($All -or (-not $Names.Count -and -not $Tags.Count)) { return @($pool | ForEach-Object { $_.Id }) }
#     if ($Names.Count) {
#         $bad = @($Names | Where-Object { $_ -notin $script:KnownSuites.Id })
#         if ($bad.Count) {
#             Write-Host ('Unknown suite(s): {0}. Known: {1}' -f ($bad -join ', '), ($script:KnownSuites.Id -join ', ')) -ForegroundColor Red
#             return @()
#         }
#         return @($pool | Where-Object { $_.Id -in $Names } | ForEach-Object { $_.Id })
#     }
#     @($pool | Where-Object { @($_.Tags | Where-Object { $_ -in $Tags }).Count } | ForEach-Object { $_.Id })
# }

# function ConvertTo-ArgList([hashtable]$Options) {
#     foreach ($k in $Options.Keys) {
#         $v = $Options[$k]
#         if ($v -is [switch] -or $v -is [bool]) { if ($v) { "-$k" } }
#         elseif ($v -is [int]) { if ($v -gt 0) { "-$k"; "$v" } }
#         elseif ($v) { "-$k"; "$v" }
#     }
# }

# function Invoke-Orchestrator($Paths, [hashtable]$Options) {
#     $o = $Options.Clone()
#     if ($o.Mode -ne 'rig') { $o.Remove('ComposeFile'); $o.Remove('StartRig') }
#     $o.Remove('Mode')
#     $script = Join-Path $Paths.Core 'orchestrate.ps1'
#     $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + @(ConvertTo-ArgList $o)
#     $quoted = $argv | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
#     $p = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList $quoted -WorkingDirectory $Paths.Repo -NoNewWindow -Wait -PassThru
#     return $p.ExitCode
# }