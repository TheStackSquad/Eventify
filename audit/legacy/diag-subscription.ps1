$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest')
Write-Host '== 1. is the 20s interval in the backend environment? =='
docker compose -f $dc config | Select-String 'SUBSCRIPTION_WORKER_INTERVAL|LOG_LEVEL'
Write-Host '== 2. do the views see the seeded rows? =='
docker @p -c "SELECT 'payment' AS view, count(*) FROM subscriptions WHERE status = 'active' AND payment_success_sent_at IS NULL AND last_payment_date IS NOT NULL UNION ALL SELECT '7d', count(*) FROM v_subscriptions_needing_7d_reminder UNION ALL SELECT '3d', count(*) FROM v_subscriptions_needing_3d_reminder UNION ALL SELECT '1d', count(*) FROM v_subscriptions_needing_1d_reminder UNION ALL SELECT 'expired', count(*) FROM v_subscriptions_needing_expired_notice"
Write-Host '== 3. were any seeded rows marked as handled? =='
docker @p -c "SELECT count(*) FILTER (WHERE payment_success_sent_at IS NOT NULL AND payment_reference LIKE 'SEED-pay-%') AS pay_marked, count(*) FILTER (WHERE reminder_7d_sent_at IS NOT NULL) AS r7_marked, count(*) FILTER (WHERE reminder_3d_sent_at IS NOT NULL) AS r3_marked, count(*) FILTER (WHERE reminder_1d_sent_at IS NOT NULL) AS r1_marked, count(*) FILTER (WHERE expired_notice_sent_at IS NOT NULL) AS exp_marked FROM subscriptions WHERE payment_reference LIKE 'SEED-%'"
Write-Host '== 4. outbox rows from the seeds =='
docker @p -c "SELECT count(*) FROM email_outbox WHERE recipient_email LIKE 'sub-%@example.com'"
Write-Host '== 5. backend log (subscription lines and errors) =='
docker compose -f $dc logs backend --since 30m | Select-String -Pattern 'ubscription|ERR' | Select-Object -First 10