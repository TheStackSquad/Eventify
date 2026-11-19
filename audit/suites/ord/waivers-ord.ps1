# audit/suites/ord/waivers-ord.ps1
# Applies audit\suites\ord\waivers.psd1 to the results of a run, before the report is written.
# A waiver never hides a check: the result stays in the report, marked WAIVED, with its reason.
function Get-OrdWaivers {
    $path = Join-Path $AuditDir 'suites\ord\waivers.psd1'
    if (-not (Test-Path -LiteralPath $path)) { return @() }
    @((Import-PowerShellDataFile -LiteralPath $path).Waivers)
}

function Invoke-OrdWaivers {
    $today = (Get-Date).ToUniversalTime().Date
    foreach ($w in (Get-OrdWaivers)) {
        $expires = [datetime]::ParseExact([string]$w.Expires, 'yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture)
        foreach ($r in @($Results | Where-Object { $_.Id -eq $w.Check })) {
            if ($r.Outcome -eq 'FAIL') {
                if ($today -le $expires.Date) {
                    $r.Outcome = 'WAIVED'
                    $r.Note = ('waived until {0} ({1}): {2}' -f $w.Expires, $w.Finding, $w.Reason)
                    Write-Host ('[WAIVED] {0} {1}  ({2})' -f $r.Id, $r.Name, $r.Note) -ForegroundColor Yellow
                }
                else {
                    $r.Note = ('the waiver for {0} expired on {1}: fix it, or renew the waiver with a reason' -f $w.Finding, $w.Expires)
                }
            }
            elseif ($r.Outcome -eq 'PASS') {
                Add-Result 'ORD-W0' ('waiver no longer needed for {0}' -f $w.Check) 'entry removed from waivers.psd1' 'the check passes now' 'INFO' 'Delete this entry from audit\suites\ord\waivers.psd1.'
            }
        }
    }
}
