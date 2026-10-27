# audit/core/ui.ps1 : collect check results and print them with fix hints.

$script:Checks = [System.Collections.Generic.List[object]]::new()

function Add-Check($Group, $Name, $Status, $Detail = '', $Fix = '') {
    $script:Checks.Add([pscustomobject]@{ Group = $Group; Name = $Name; Status = $Status; Detail = $Detail; Fix = $Fix })
}

function Show-Checks {
    $color = @{ PASS = 'Green'; WARN = 'Yellow'; FAIL = 'Red'; SKIP = 'DarkGray' }
    $group = ''
    foreach ($c in $script:Checks) {
        if ($c.Group -ne $group) { $group = $c.Group; Write-Host "`n[$group]" -ForegroundColor Cyan }
        Write-Host ('  {0,-5} {1,-24} {2}' -f $c.Status, $c.Name, $c.Detail) -ForegroundColor $color[$c.Status]
    }
    $fails = @($script:Checks | Where-Object Status -eq 'FAIL')
    $warns = @($script:Checks | Where-Object Status -eq 'WARN').Count
    if ($fails.Count) {
        Write-Host "`nHow to fix:" -ForegroundColor Yellow
        foreach ($f in $fails) { if ($f.Fix) { Write-Host ('  {0}: {1}' -f $f.Name, $f.Fix) } }
    }
    $tone = if ($fails.Count) { 'Red' } else { 'Green' }
    Write-Host ("`nDoctor: {0} fail, {1} warn" -f $fails.Count, $warns) -ForegroundColor $tone
    return $fails.Count
}