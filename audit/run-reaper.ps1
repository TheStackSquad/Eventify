param([int]$Orders = 100, [int]$Spread = 70)
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest')

# Stage 1: pause the reaper's input by aging from the DB side AFTER creation, BEFORE payments
# The k6 script sleeps a random 0..Spread seconds before each payment, which gives us this window.
Start-Job -ScriptBlock {
  param($dc, $p)
  Start-Sleep 20                          # let setup() finish creating orders
  & docker @p -c "UPDATE orders SET created_at = now() - interval '16 minutes' WHERE status::text = 'pending' AND customer_email LIKE 'rp+%@example.com';" | Out-Null
} -ArgumentList $dc, $p | Out-Null

.\audit\run-k6.ps1 -Script reaper -Extra "ORDERS=$Orders","SPREAD_S=$Spread"
Get-Job | Wait-Job | Remove-Job

Write-Host 'waiting two minutes for the reaper to finish its passes'
Start-Sleep 120
Write-Host '== final states of the test orders =='
docker @p -c "SELECT status, count(*) FROM orders WHERE customer_email LIKE 'rp+%@example.com' AND created_at > now() - interval '40 minutes' OR (customer_email LIKE 'rp+%@example.com' AND created_at < now() - interval '15 minutes') GROUP BY 1 ORDER BY 1;"
Write-Host '== paid orders whose tickets exist =='
docker @p -c "SELECT o.status, count(*) AS orders, count(*) FILTER (WHERE EXISTS (SELECT 1 FROM tickets t WHERE t.order_id = o.id)) AS with_tickets FROM orders o WHERE o.customer_email LIKE 'rp+%@example.com' GROUP BY 1 ORDER BY 1;"
Write-Host '== integrity =='
Get-Content audit\sql\integrity.sql | docker @p