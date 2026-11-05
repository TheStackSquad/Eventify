# audit/core/launch.ps1

# core/launch.ps1 : pick suites and start the orchestrator. The suite list moves to config/suites.psd1 in P4.
$script:KnownSuites = @(
    @{ Id = 'SUB'; Tags = @('money', 'fast'); Modes = @('rig', 'tunnel') }
)

function Select-Suites([string[]]$Names, [string[]]$Tags, [bool]$All, [string]$Mode) {
    $pool = @($script:KnownSuites | Where-Object { $_.Modes -contains $Mode })
    if ($All -or (-not $Names.Count -and -not $Tags.Count)) { return @($pool | ForEach-Object { $_.Id }) }
    if ($Names.Count) {
        $bad = @($Names | Where-Object { $_ -notin $script:KnownSuites.Id })
        if ($bad.Count) {
            Write-Host ('Unknown suite(s): {0}. Known: {1}' -f ($bad -join ', '), ($script:KnownSuites.Id -join ', ')) -ForegroundColor Red
            return @()
        }
        return @($pool | Where-Object { $_.Id -in $Names } | ForEach-Object { $_.Id })
    }
    @($pool | Where-Object { @($_.Tags | Where-Object { $_ -in $Tags }).Count } | ForEach-Object { $_.Id })
}

function ConvertTo-ArgList([hashtable]$Options) {
    foreach ($k in $Options.Keys) {
        $v = $Options[$k]
        if ($v -is [switch] -or $v -is [bool]) { if ($v) { "-$k" } }
        elseif ($v -is [int]) { if ($v -gt 0) { "-$k"; "$v" } }
        elseif ($v) { "-$k"; "$v" }
    }
}

function Invoke-Orchestrator($Paths, [hashtable]$Options) {
    $o = $Options.Clone()
    if ($o.Mode -ne 'rig') { $o.Remove('ComposeFile'); $o.Remove('StartRig') }
    $o.Remove('Mode')
    $script = Join-Path $Paths.Core 'orchestrate.ps1'
    $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $script) + @(ConvertTo-ArgList $o)
    $quoted = $argv | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }
    $p = Start-Process -FilePath (Get-Process -Id $PID).Path -ArgumentList $quoted -WorkingDirectory $Paths.Repo -NoNewWindow -Wait -PassThru
    return $p.ExitCode
}