# audit/runner/probe-payment.ps1

# audit/runner/probe-payment.ps1 : why was a real payment not applied?
# Section 1 needs ngrok running (run this in a SECOND terminal while the manual test waits). Sections 2-5 work any time.
param([Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F-]{36}$')][string]$Reference)

function Section([string]$t) { Write-Host "`n== $t ==" -ForegroundColor Cyan }

Section '1. webhook calls captured by ngrok'
try {
    $cap = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/requests/http?limit=50' -TimeoutSec 3
    foreach ($q in @($cap.requests | Where-Object { $_.request.uri -like '*/api/webhooks/paystack*' })) {
        try {
            $hasSig = [bool]($q.request.headers.PSObject.Properties.Name | Where-Object { $_ -ieq 'X-Paystack-Signature' })
            $raw = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($q.request.raw))
            $j = ($raw -split "\r?\n\r?\n", 2)[1] | ConvertFrom-Json
            $meta = if ($j.data.metadata) { ($j.data.metadata.PSObject.Properties.Name -join ',') } else { '(none)' }
            '{0} HTTP {1} duration={2} from {3} signature-header={4} event={5} ref={6} status={7} metadata=[{8}]' -f ([string]$q.start).Substring(11, 8), $q.response.status_code, $q.duration, $q.remote_addr, $hasSig, $j.event, $j.data.reference, $j.data.status, $meta
        } catch { '(a captured request whose body is not JSON, for example the 2 MB test)' }
    }
} catch { 'ngrok is not running, so its captured requests are gone (the orchestrator stops it when it finishes).' }

Section "2. what Paystack says about $Reference"
$m = Select-String -Path 'audit/docker/.env' -Pattern '^\s*PAYSTACK_SECRET_KEY\s*=\s*(.+?)\s*$' | Select-Object -First 1
if (-not $m) { 'no PAYSTACK_SECRET_KEY in audit/docker/.env' }
else {
    $key = $m.Matches[0].Groups[1].Value.Trim('"', "'")
    try {
        $d = (Invoke-RestMethod -Uri "https://api.paystack.co/transaction/verify/$Reference" -Headers @{ Authorization = "Bearer $key" }).data
        [pscustomobject]@{ status = $d.status; amount = $d.amount; currency = $d.currency; gateway_response = $d.gateway_response; paid_at = $d.paid_at; channel = $d.channel; metadata = ($d.metadata | ConvertTo-Json -Compress -Depth 4) } | Format-List
    } catch { 'Paystack answered: ' + $_.Exception.Message }
    Remove-Variable key
}

Section '3. ledger row and active subscriptions'
$p = @('compose', '-f', 'audit/docker/docker-compose.loadtest.yml', 'exec', '-T', 'db', 'psql', '-U', 'loadtest', '-d', 'eventify_loadtest', '-x', '-c')
docker @p "SELECT * FROM subscription_payments WHERE reference = '$Reference';"
docker @p "SELECT count(*) AS active_subscriptions FROM subscriptions WHERE status = 'active';"

Section '4. backend log lines (this reference, and the last webhook lines)'
$dir = Get-ChildItem $env:TEMP -Directory -Filter 'eventify-matrix-*' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($dir) {
    $logs = Join-Path $dir.FullName 'backend*.log'
    Select-String -Path $logs -Pattern $Reference | Select-Object -First 12 | ForEach-Object { $_.Line }
    Select-String -Path $logs -Pattern 'ebhook' | Select-Object -Last 8 | ForEach-Object { $_.Line }
} else { 'no backend log folder found' }

Section '5. the latest matrix report rows for the payment tests'
$r = Get-ChildItem audit/results -Filter 'subscription-matrix-*.md' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($r) { $r.Name; Select-String -Path $r.FullName -Pattern '^\| (T1|T2|T5|T7)\.' | ForEach-Object { $_.Line } }