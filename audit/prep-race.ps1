param([int]$Stock = 10)
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$sql = @"
WITH ev AS (SELECT id FROM events WHERE event_title LIKE 'LT Event %' ORDER BY random() LIMIT 1),
low AS (
  INSERT INTO ticket_tiers (event_id, name, price_kobo, capacity, sold, available)
  SELECT id, 'Race-$Stock-' || substr(md5(random()::text),1,6), 150000, $Stock, 0, $Stock FROM ev
  RETURNING id, event_id),
ta AS (
  INSERT INTO ticket_tiers (event_id, name, price_kobo, capacity, sold, available)
  SELECT event_id, 'DL-A-' || substr(md5(random()::text),1,6), 100000, 1000000, 0, 1000000 FROM low
  RETURNING id),
tb AS (
  INSERT INTO ticket_tiers (event_id, name, price_kobo, capacity, sold, available)
  SELECT event_id, 'DL-B-' || substr(md5(random()::text),1,6), 100000, 1000000, 0, 1000000 FROM low
  RETURNING id)
SELECT json_build_object('eventId', low.event_id, 'lowTierId', low.id, 'tierA', ta.id, 'tierB', tb.id, 'stock', $Stock)
FROM low, ta, tb;
"@
New-Item -ItemType Directory -Force audit\k6\data | Out-Null
$json = $sql | docker compose -f $dc exec -T db psql -q -At -h 127.0.0.1 -U loadtest -d eventify_loadtest -v ON_ERROR_STOP=1
Set-Content audit\k6\data\race.json $json -Encoding ascii
Get-Content audit\k6\data\race.json