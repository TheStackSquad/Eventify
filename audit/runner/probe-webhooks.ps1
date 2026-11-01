# audit/runner/probe-webhooks.ps1

# What did the backend answer to each webhook that ngrok captured? Needs ngrok's inspector (http://127.0.0.1:4040).
param([string]$Reference = '')
function Decode([string]$b64) { if ($b64) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) } else { '' } }
function BodyOf([string]$raw) { $i = $raw.IndexOf("`r`n`r`n"); if ($i -ge 0) { $raw.Substring($i + 4) } else { '' } }
$cap = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/requests/http?limit=100' -TimeoutSec 3
foreach ($q in @($cap.requests | Where-Object { $_.request.uri -like '*/api/webhooks/paystack*' })) {
    $ev = ''; $ref = ''
    try { $j = (BodyOf (Decode $q.request.raw)) | ConvertFrom-Json; $ev = $j.event; $ref = $j.data.reference } catch { }
    if ($Reference -and $ref -ne $Reference) { continue }
    $ans = ((BodyOf (Decode $q.response.raw)) -replace '\s+', ' ').Trim()
    '{0} HTTP {1} {2,5}ms from {3,-15} {4} {5}' -f ([string]$q.start).Substring(11, 8), $q.response.status_code, [int]($q.duration / 1e6), $q.remote_addr, $ev, $ref
    '    answer: ' + $ans.Substring(0, [Math]::Min(160, $ans.Length))
}