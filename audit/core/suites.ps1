# audit/core/suites.ps1

# core/suites.ps1 : suites announce themselves with audit/suites/<id>/suite.psd1. The door scans them, so a new suite never edits a shared file.
$script:ValidModes = @('rig', 'tunnel')

function Get-SuiteManifests([string]$AuditDir) {
    $dir = [IO.Path]::Combine($AuditDir, 'suites')
    if (-not (Test-Path -LiteralPath $dir)) { return @() }
    $found = foreach ($d in Get-ChildItem -LiteralPath $dir -Directory) {
        $file = Join-Path $d.FullName 'suite.psd1'
        if (-not (Test-Path -LiteralPath $file)) { continue }
        try { $m = Import-PowerShellDataFile -LiteralPath $file }
        catch { [pscustomobject]@{ Id = $d.Name.ToUpper(); Path = $file; Problems = @("cannot be read: $($_.Exception.Message)") }; continue }
        $m['Path'] = $file
        [pscustomobject]$m
    }
    @($found | Sort-Object { if ($_.PSObject.Properties['Order']) { [int]$_.Order } else { 999 } }, Id)
}

function Get-SuiteProblems($Manifest, [string]$AuditDir) {
    if ($Manifest.PSObject.Properties['Problems']) { return @($Manifest.Problems) }
    $p = New-Object System.Collections.Generic.List[string]
    foreach ($k in 'Id', 'Orchestrator', 'Modes', 'Order') { if (-not $Manifest.PSObject.Properties[$k]) { $p.Add("missing key $k") } }
    if ($Manifest.PSObject.Properties['Id'] -and $Manifest.Id -notmatch '^[A-Z][A-Z0-9]{1,5}$') { $p.Add("Id '$($Manifest.Id)' must be 2 to 6 capital letters or digits") }
    if ($Manifest.PSObject.Properties['Modes']) { foreach ($m in @($Manifest.Modes)) { if ($script:ValidModes -notcontains $m) { $p.Add("unknown mode '$m'") } } }
    if ($Manifest.PSObject.Properties['Orchestrator']) {
        $o = [IO.Path]::GetFullPath([IO.Path]::Combine($AuditDir, ($Manifest.Orchestrator -replace '\\', '/')))
        if (-not (Test-Path -LiteralPath $o)) { $p.Add("Orchestrator not found: $($Manifest.Orchestrator)") }
    }
    return @($p)
}

function Get-AuditSuites([string]$AuditDir) {
    $all = @(Get-SuiteManifests $AuditDir)
    $seen = @{}
    foreach ($m in $all) {
        $problems = @(Get-SuiteProblems $m $AuditDir)
        if ($m.Id) {
            if ($seen.ContainsKey($m.Id)) { $problems += "duplicate Id $($m.Id) (also in $($seen[$m.Id]))" } else { $seen[$m.Id] = $m.Path }
        }
        $m | Add-Member -NotePropertyName Problems -NotePropertyValue $problems -Force
    }
    return $all
}

function Select-AuditSuites($Suites, [string[]]$Names, [string[]]$Tags, [string]$Mode) {
    $pool = @($Suites | Where-Object { -not @($_.Problems).Count -and (@($_.Modes) -contains $Mode) })
    if ($Names.Count) {
        $bad = @($Names | Where-Object { $_ -notin @($Suites | ForEach-Object { $_.Id }) })
        if ($bad.Count) { Write-Host ('Unknown suite(s): {0}. Known: {1}' -f ($bad -join ', '), (@($Suites | ForEach-Object { $_.Id }) -join ', ')) -ForegroundColor Red; return @() }
        return @($pool | Where-Object { $_.Id -in $Names })
    }
    if ($Tags.Count) { return @($pool | Where-Object { @($_.Tags | Where-Object { $_ -in $Tags }).Count }) }
    return $pool
}

function Show-AuditSuites($Suites) {
    foreach ($s in $Suites) {
        $ok = -not @($s.Problems).Count
        $line = '{0,-6} order {1,-3} {2,-13} {3,-18} requires m{4,-3} {5}' -f $s.Id, $s.Order, (@($s.Modes) -join '+'), (@($s.Tags) -join ','), $s.Requires, $s.Title
        Write-Host $line -ForegroundColor $(if ($ok) { 'Green' } else { 'Red' })
        foreach ($p in @($s.Problems)) { Write-Host "       problem: $p" -ForegroundColor Red }
    }
}