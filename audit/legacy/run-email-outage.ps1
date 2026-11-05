# // audit/run-email-outage.ps1

# Provider outage, then recovery. Prints PASS or FAIL.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest','-At')
function Q($sql) { [int]((docker @p -c $sql) | Select-Object -First 1) }
function Inbox { try { (Invoke-RestMethod http://localhost:8025/api/v1/messages -TimeoutSec 3).total } catch { $null } }
function Waiting { Q "SELECT count(*) FROM email_outbox WHERE status IN ('pending','processing')" }

Write-Host '1/5 drain the queue and empty the mailbox'
for ($i = 0; $i -lt 60 -and (Waiting) -gt 0; $i++) { Start-Sleep 5 }
docker compose -f $dc restart mailpit | Out-Null
for ($i = 0; $i -lt 30 -and $null -eq (Inbox); $i++) { Start-Sleep 2 }

Write-Host '2/5 provider goes down; customers keep paying'
docker compose -f $dc stop mailpit | Out-Null
$sent0 = Q "SELECT count(*) FROM email_outbox WHERE status = 'sent'"
$all0  = Q "SELECT count(*) FROM email_outbox"
.\audit\run-k6.ps1 -Script mixed -Profile smoke *> audit\results\raw\email-outage-k6.log
Start-Sleep 75
$queued   = (Q "SELECT count(*) FROM email_outbox") - $all0
$sentDown = Q "SELECT count(*) FROM email_outbox WHERE status = 'sent'"
$retrying = Q "SELECT count(*) FROM email_outbox WHERE attempts > 0 AND status IN ('pending','processing')"
Write-Host "   new emails queued: $queued ; marked sent while down: $($sentDown - $sent0) ; retrying: $retrying"

Write-Host '3/5 provider returns'
docker compose -f $dc start mailpit | Out-Null

Write-Host '4/5 waiting for the backlog to drain (up to 10 minutes)'
$deadline = (Get-Date).AddMinutes(10)
while ((Waiting) -gt 0 -and (Get-Date) -lt $deadline) { Start-Sleep 10 }
Start-Sleep 5

Write-Host '5/5 verdict'
$dead  = Q "SELECT count(*) FROM email_outbox WHERE status = 'dead'"
$dupes = Q "SELECT count(*) FROM (SELECT dedupe_key FROM email_outbox WHERE dedupe_key IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d"
$sent1 = Q "SELECT count(*) FROM email_outbox WHERE status = 'sent'"
$inbox = Inbox
Write-Host "   delivered after recovery: $($sent1 - $sent0) of $queued ; dead: $dead ; duplicates: $dupes ; mailbox: $inbox"
if (($sentDown - $sent0) -eq 0 -and $queued -gt 0 -and $retrying -gt 0 -and ($sent1 - $sent0) -eq $queued -and $dead -eq 0 -and $dupes -eq 0 -and $inbox -eq $queued) {
  'PASS: nothing lost, nothing duplicated, nothing marked sent during the outage'
} else { 'FAIL' }