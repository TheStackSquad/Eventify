# audit/suites/ord/report-ord.ps1
# Evidence report for the ORD suite: audit\results\ord-matrix-<timestamp>.md and .json.
# SUB's Write-Report hardcodes SUB claims, so ORD keeps its own until the shared one is parametrised.

function ConvertTo-OrdMdCell([string]$Text) {
    (($Text -replace '\|', '\|') -replace "`r?`n", ' ')
}

function Write-OrdReport {
    if (-not (Test-Path -LiteralPath $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir | Out-Null }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $base = Join-Path $ResultsDir "ord-matrix-$stamp"
    $git = Get-OrdGitInfo

    $run = [ordered]@{
        suite            = 'ORD'
        mode             = $Mode
        generated        = (Get-Date).ToString('o')
        commit           = $git.Commit
        branch           = $git.Branch
        uncommittedPaths = $git.Dirty
        migrationVersion = (Get-OrdMigrationVersion)
        dbZone           = (Get-OrdDbZone)
        paystack         = $RunInfo.PaystackMode
        stub             = $RunInfo.StubBase
    }
    $counts = [ordered]@{}
    foreach ($g in ($Results | Group-Object Outcome | Sort-Object Name)) { $counts[$g.Name] = $g.Count }

    $md = New-Object System.Collections.Generic.List[string]
    $md.Add('# ORD evidence report')
    $md.Add('')
    foreach ($k in $run.Keys) { $md.Add(('- **{0}**: {1}' -f $k, $run[$k])) }
    $md.Add('')
    $md.Add('## Summary')
    $md.Add('')
    $md.Add((($counts.Keys | ForEach-Object { '{0} {1}' -f $_, $counts[$_] }) -join '   '))
    $md.Add('')
    $md.Add('## Results')
    $md.Add('')
    $md.Add('| Id | Outcome | Check | Expected | Actual | Note |')
    $md.Add('|---|---|---|---|---|---|')
    foreach ($r in $Results) {
        $md.Add(('| {0} | {1} | {2} | {3} | {4} | {5} |' -f $r.Id, $r.Outcome, (ConvertTo-OrdMdCell $r.Name), (ConvertTo-OrdMdCell $r.Expected), (ConvertTo-OrdMdCell $r.Actual), (ConvertTo-OrdMdCell $r.Note)))
    }
    $fails = @($Results | Where-Object { $_.Outcome -eq 'FAIL' })
    $md.Add('')
    $md.Add('## Next steps')
    $md.Add('')
    if ($fails.Count -eq 0) { $md.Add('No failed checks.') }
    foreach ($f in $fails) { $md.Add(('- **{0}** {1}: {2}' -f $f.Id, $f.Name, (Get-OrdHint $f.Id))) }

    Set-Content -LiteralPath "$base.md" -Value ($md -join "`n") -Encoding utf8NoBOM
    $doc = [ordered]@{}
    $doc['run'] = $run
    $doc['counts'] = $counts
    $doc['results'] = $Results.ToArray()
    $json = $doc | ConvertTo-Json -Depth 5
    Set-Content -LiteralPath "$base.json" -Value $json -Encoding utf8NoBOM

    Write-Host "`nEvidence written to:" -ForegroundColor Cyan
    Write-Host "  $base.md"
    Write-Host "  $base.json"
}
