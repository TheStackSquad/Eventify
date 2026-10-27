# //audit/run-gateway-down.ps1

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest','-At')

.\audit\prep-race.ps1 -Stock 10 | Out-Null
docker compose -f $dc stop stub | Out-Null
.\audit\run-k6.ps1 -Script oversell *> audit\results\raw\gateway-down.log   # its thresholds fail on purpose
docker compose -f $dc start stub | Out-Null

$tier    = docker @p -c "SELECT id FROM ticket_tiers WHERE name LIKE 'Race-%' ORDER BY created_at DESC LIMIT 1"
$pending = docker @p -c "SELECT count(*) FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.ticket_tier_id = '$tier' AND o.status::text = 'pending'"
$held    = docker @p -c "SELECT sold FROM ticket_tiers WHERE id = '$tier'"
"pending orders on the race tier: $pending"
"tickets still held:               $held"
docker @p -c "SELECT o.status, count(*) FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE oi.ticket_tier_id = '$tier' GROUP BY 1"
if ([int]$pending -eq 0 -and [int]$held -eq 0) { 'PASS: stock released after the gateway failed' } else { 'FAIL' }
.\audit\wait-rig.ps1