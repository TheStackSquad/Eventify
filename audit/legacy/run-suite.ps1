# // audit/run-suite.ps1 -Tag after

param([string]$Tag = 'after')
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
.\audit\wait-rig.ps1
$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest')
function Latest($n) { Get-ChildItem "audit\results\$n-*.txt" | Sort-Object LastWriteTime | Select-Object -Last 1 }

.\audit\prep-race.ps1 -Stock 10 | Out-Null
$runs = @(
  @{ n='verify';   p=@{ Script='verify' } },
  @{ n='oversell'; p=@{ Script='oversell' } },
  @{ n='deadlock'; p=@{ Script='oversell'; Extra=@('MODE=deadlock') } },
  @{ n='webhook';  p=@{ Script='webhook' } }
)
foreach ($r in $runs) {
  Write-Host "== $($r.n) =="
  $x = $r.p
  & .\audit\run-k6.ps1 @x *> "audit\results\raw\$($r.n)-$Tag.log"
  Get-Content (Latest $r.n)
}
Write-Host '== race tier =='
docker @p -c "SELECT name, capacity, sold, available, (SELECT count(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE oi.ticket_tier_id = t.id AND o.status::text IN ('pending','success')) AS live_units FROM ticket_tiers t WHERE name LIKE 'Race-%' ORDER BY created_at DESC LIMIT 1;"

Write-Host '== verify scenarios =='
Get-Content audit\sql\verify_check.sql | docker @p
Write-Host '== webhook outcomes =='
docker @p -c "SELECT status, count(*) FROM orders WHERE customer_email LIKE 'wh+%@example.com' AND created_at > now() - interval '15 minutes' GROUP BY 1 ORDER BY 1;"
Write-Host '== profit columns (F-014) =='
# docker @p -c "SELECT count(*) AS paid, count(*) FILTER (WHERE paystack_fee = 0) AS fee_zero, count(*) FILTER (WHERE app_profit = 0) AS profit_zero FROM orders WHERE status::text = 'success';"
docker @p -c "SELECT count(*) AS paid_recent, count(*) FILTER (WHERE paystack_fee = 0) AS fee_zero, count(*) FILTER (WHERE app_profit = 0) AS profit_zero FROM orders WHERE status::text = 'success' AND created_at > now() - interval '15 minutes';"
Write-Host '== integrity =='
Get-Content audit\sql\integrity.sql | docker @p
Write-Host '== deadlock lines in backend log =='
(docker compose -f $dc logs backend | Select-String 'deadlock' | Measure-Object).Count