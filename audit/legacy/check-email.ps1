$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest')
docker @p -c "SELECT status, count(*), max(attempts) AS max_attempts FROM email_outbox GROUP BY 1 ORDER BY 1;"
docker @p -c "SELECT (SELECT count(*) FROM orders WHERE status::text = 'success') AS paid_orders, (SELECT count(*) FROM email_outbox WHERE template_type = 'TICKET_DELIVERY') AS queued, (SELECT count(*) FROM email_outbox WHERE template_type = 'TICKET_DELIVERY' AND status = 'sent') AS sent, (SELECT count(*) FROM (SELECT dedupe_key FROM email_outbox WHERE dedupe_key IS NOT NULL GROUP BY 1 HAVING count(*) > 1) d) AS dupes;"
$m = Invoke-RestMethod http://localhost:8025/api/v1/messages -ErrorAction SilentlyContinue
"mailpit received: $($m.total)"