# Rebuild the load-test rig from zero, in the right order. Rig volumes only; your dev DB is untouched.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$psql = @('compose','-f',$dc,'exec','-T','db','psql','-h','127.0.0.1','-U','loadtest','-d','eventify_loadtest')

# Set environment variables to point to the key paths inside the container
Remove-Item Env:\RSA_PRIVATE_KEY -ErrorAction SilentlyContinue
Remove-Item Env:\RSA_PUBLIC_KEY  -ErrorAction SilentlyContinue
$env:RSA_PRIVATE_KEY_PATH = '/app/config/keys/private.pem'
$env:RSA_PUBLIC_KEY_PATH  = '/app/config/keys/public.pem'

Write-Host '1/7 wipe rig volumes'; docker compose -f $dc down -v
Write-Host '2/7 start db';         docker compose -f $dc up -d db

Write-Host '3/7 wait for schema load'
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  docker @psql -At -c 'select 1' *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep 2
}
if (-not $ready) { Write-Host "db never became ready. Run: docker compose -f $dc logs db"; exit 1 }
$tables = docker @psql -At -c "select count(*) from information_schema.tables where table_schema='public'"
Write-Host "   tables: $tables"
if ([int]$tables -lt 20) { Write-Host 'schema did not load'; exit 1 }
Get-Content audit\sql\m2_email_outbox.sql | docker @psql -v ON_ERROR_STOP=1 | Out-Null

Write-Host '4/7 seed + refresh views'
Get-Content audit\sql\seed.sql | docker @psql -v ON_ERROR_STOP=1 | Select-Object -Last 8
Get-Content audit\sql\refresh_views.sql | docker @psql -v ON_ERROR_STOP=1 | Out-Null

Write-Host '5/7 build targets.json'
New-Item -ItemType Directory -Force audit\k6\data | Out-Null
$json = docker @psql -At -c "SELECT json_agg(json_build_object('eventId', e.id, 'tierId', t.id)) FROM events e JOIN ticket_tiers t ON t.event_id = e.id WHERE e.event_title LIKE 'LT Event %' AND t.name = 'General'"
Set-Content audit\k6\data\targets.json $json -Encoding ascii
$n = (Get-Content audit\k6\data\targets.json -Raw | ConvertFrom-Json).Count
Write-Host "   targets: $n"
if ($n -lt 1) { exit 1 }

Write-Host '6/7 start backend + stub'
docker compose -f $dc up -d --build


.\audit\wait-rig.ps1
Write-Host '7/7 wait for backend'
for ($i = 0; $i -lt 30; $i++) {
  try { $h = Invoke-RestMethod http://localhost:18081/health -TimeoutSec 2; if ($h.status -eq 'ok') { Write-Host 'READY'; exit 0 } } catch {}
  Start-Sleep 2
}
Write-Host "backend not healthy. Run: docker compose -f $dc logs backend --tail 30"; exit 1