# audit/matrix/checks-lifecycle.ps1

# audit/matrix/checks-lifecycle.ps1 : reminders, expiry and repeat passes, driven by ageing rows with SQL.
# Needs the subscription worker on a short interval (the launcher sets SUBSCRIPTION_WORKER_INTERVAL=20s).

function Wait-Until([scriptblock]$Condition, [int]$TimeoutSec = 100) {
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (& $Condition) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

# "7-day / 3-day / 1-day / expired / receipt" email counts for one address, for example 1/0/0/0/0
function Get-OutboxCounts([string]$Email) {
    $templates = 'SUBSCRIPTION_REMINDER_7D', 'SUBSCRIPTION_REMINDER_3D', 'SUBSCRIPTION_REMINDER_1D', 'SUBSCRIPTION_EXPIRED', 'SUBSCRIPTION_PAYMENT_SUCCESS'
    ($templates | ForEach-Object {
        [int](Invoke-Sql ("SELECT count(*) FROM email_outbox WHERE recipient_email = {0} AND template_type = '{1}'" -f (Get-SqlLiteral $Email), $_))
    }) -join '/'
}

function New-LifecycleSub([string]$VendorId, [string]$Status, [string]$Expires) {
    Assert-Guid $VendorId "vendor id"
    $sql = "INSERT INTO subscriptions (vendor_id, tier, status, starts_at, expires_at, price, currency, payment_reference, last_payment_date) VALUES ('{0}', 'basic', '{1}', now() - interval '30 days', {2}, 350000, 'NGN', 'LIFE-' || gen_random_uuid(), now() - interval '30 days')" -f $VendorId, $Status, $Expires
    Invoke-Sql $sql | Out-Null
}

# L1 reminders, L2 expiry, L4 a repeated pass changes nothing
function Test-SubscriptionLifecycle($Ctx) {
    if (-not $env:SUBSCRIPTION_WORKER_INTERVAL -or -not $env:AUDIT_VENDOR2_EMAIL) {
        Add-Result "L1.0" "subscription lifecycle checks" "worker interval set" "not set" "SKIP" "start through run-ochestrator.ps1, which sets SUBSCRIPTION_WORKER_INTERVAL"
        return
    }
    $elite = @{ Id = 'f5000000-0000-0000-0000-000000000001'; Mail = 'elite@events.test' }
    $taste = @{ Id = 'f5000000-0000-0000-0000-000000000002'; Mail = 'tastebud@catering.test' }
    $beat  = @{ Id = 'f5000000-0000-0000-0000-000000000003'; Mail = 'beatmaster@dj.test' }
    $two   = @{ Id = (Get-VendorId $env:AUDIT_VENDOR2_EMAIL); Mail = $env:AUDIT_VENDOR2_EMAIL }
    $all = @($elite, $taste, $beat, $two)

    foreach ($c in $all) {
        if ([int](Invoke-Sql "SELECT count(*) FROM vendors WHERE id = '$($c.Id)'") -ne 1) {
            Add-Result "L1.0" "lifecycle fixtures" "vendor $($c.Id) exists" "missing" "SKIP" "the background SQL fixtures were not applied"
            return
        }
        Invoke-Sql "DELETE FROM subscriptions WHERE vendor_id = '$($c.Id)'" | Out-Null
        Invoke-Sql ("DELETE FROM email_outbox WHERE recipient_email = {0} AND template_type LIKE 'SUBSCRIPTION_%'" -f (Get-SqlLiteral $c.Mail)) | Out-Null
    }

    New-LifecycleSub $elite.Id 'active'  "now() + interval '6 days'"     # inside the 7-day window
    New-LifecycleSub $taste.Id 'active'  "now() + interval '2 days'"     # as after an outage: only the 3-day reminder is owed
    New-LifecycleSub $beat.Id  'active'  "now() - interval '1 minute'"   # lapsed, not yet swept
    New-LifecycleSub $two.Id   'expired' "now() - interval '30 days'"    # long expired: must stay silent
    New-LifecycleSub $two.Id   'active'  "now() + interval '12 hours'"   # inside the 1-day window

    $ready = Wait-Until {
        ((Get-OutboxCounts $elite.Mail) -eq '1/0/0/0/0') -and ((Get-OutboxCounts $taste.Mail) -eq '0/1/0/0/0') -and
        ((Get-OutboxCounts $two.Mail) -eq '0/0/1/0/0') -and ((Get-OutboxCounts $beat.Mail) -eq '0/0/0/1/0')
    }
    if (-not $ready) { Write-Host "       the worker did not produce the expected emails in time" -ForegroundColor Yellow }

    $n = @{}
    foreach ($c in $all) { $n[$c.Mail] = Get-OutboxCounts $c.Mail }
    Check "L1.1" "a plan 6 days from expiry gets one 7-day reminder" "1/0/0/0/0" $n[$elite.Mail] ($n[$elite.Mail] -eq '1/0/0/0/0')
    Check "L1.2" "after an outage only the nearest missed reminder (3-day) goes out" "0/1/0/0/0" $n[$taste.Mail] ($n[$taste.Mail] -eq '0/1/0/0/0')
    Check "L1.3" "a plan 12 hours from expiry gets the 1-day reminder; a long-expired row and old payments stay silent" "0/0/1/0/0" $n[$two.Mail] ($n[$two.Mail] -eq '0/0/1/0/0')

    $status = Invoke-Sql "SELECT status FROM subscriptions WHERE vendor_id = '$($beat.Id)'"
    $tier = Invoke-Sql "SELECT subscription_tier FROM vendors WHERE id = '$($beat.Id)'"
    Check "L2.1" "a lapsed plan is switched off, the vendor returns to free, one notice is queued" "expired, free, 0/0/0/1/0" "$status, $tier, $($n[$beat.Mail])" (($status -eq 'expired') -and ($tier -eq 'free') -and ($n[$beat.Mail] -eq '0/0/0/1/0'))

    Start-Sleep -Seconds 45     # at least two more worker passes
    $same = $true
    foreach ($c in $all) { if ((Get-OutboxCounts $c.Mail) -ne $n[$c.Mail]) { $same = $false } }
    Check "L4.1" "further worker passes queue nothing new" "emails queued, then counts unchanged" $(if (-not $ready) { "nothing was queued" } elseif ($same) { "unchanged" } else { "changed" }) ($ready -and $same)
}

# Receipts: each payment applied during a manual run must produce exactly one receipt email.
function Get-AppliedCount { [int](Invoke-Sql "SELECT count(*) FROM subscription_payments WHERE status = 'applied'") }
function Get-ReceiptCount { [int](Invoke-Sql "SELECT count(*) FROM email_outbox WHERE template_type = 'SUBSCRIPTION_PAYMENT_SUCCESS'") }

function Save-ReceiptBaseline { $script:ReceiptBase = @{ Applied = Get-AppliedCount; Receipts = Get-ReceiptCount } }

# L3 a first purchase and a renewal each queue one receipt
function Test-PaymentReceipts($Ctx) {
    $paid = (Get-AppliedCount) - $script:ReceiptBase.Applied
    if ($paid -lt 1) {
        Add-Result "L3.1" "each paid month queues one receipt" "a payment applied in this run" "none applied" "SKIP" "pay the first checkout so a payment is applied"
        return
    }
    $null = Wait-Until { ((Get-ReceiptCount) - $script:ReceiptBase.Receipts) -ge $paid } 90
    $got = (Get-ReceiptCount) - $script:ReceiptBase.Receipts
    Check "L3.1" "each paid month (first purchase or renewal) queues exactly one receipt" "$paid receipt(s)" "$got receipt(s)" ($got -eq $paid)
}