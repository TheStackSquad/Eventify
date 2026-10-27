# //audit/diag-email.ps1

$dc = 'audit\docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest')
Write-Host '== 1. did anything query the outbox? =='
docker @p -c "SELECT calls, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 60) AS query FROM pg_stat_statements WHERE query ILIKE '%email_outbox%' ORDER BY calls DESC LIMIT 6;"
Write-Host '== 2. main.go wiring =='
Select-String -Path backend\main.go -Pattern 'workerCtx|serviceemail|stopWorkers|Starting background workers|<-quit' | Select-Object LineNumber, Line | Format-Table -AutoSize
Write-Host '== 3. compose env =='
docker compose -f $dc config | Select-String 'SMTP_|FROM_EMAIL|GIN_MODE|LOG_LEVEL'
Write-Host '== 4. backend log =='
docker compose -f $dc logs backend | Select-String 'Email worker|SMTP|email|ERR' | Select-Object -First 10
Write-Host '== 5. integrity =='
Get-Content audit\sql\integrity.sql | docker @p