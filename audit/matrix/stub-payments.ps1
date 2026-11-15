# audit/matrix/stub-payments.ps1
# Rig mode: the Paystack stub plays the customer, so the payment tests run with no browser, tunnel or real Paystack.
#   T1 a payment applies   T2 re-delivered webhooks change nothing   T5 a short payment is parked for review
# The check ids match manual.ps1, so the report's claims are satisfied by either run; in rig mode the report adds
# "(demonstrated against the local Paystack stub)". Stub control used: /__pay/{ref}?status=&amount=&webhook=

function Invoke-StubPay([string]$Reference, [string]$Query) {
    Assert-Guid $Reference "reference"
    Invoke-Http -Method GET -Url "$($RunInfo.StubBase)/__pay/${Reference}?$Query"
}

function Wait-LedgerAttempts([string]$Reference, [int]$TimeoutSec) {
    $end = (Get-Date).AddSeconds($TimeoutSec)
    $led = Get-Ledger $Reference
    while ($led -and ($led.Attempts -lt 1) -and ((Get-Date) -lt $end)) { Start-Sleep -Seconds 2; $led = Get-Ledger $Reference }
    return $led
}

function Invoke-StubPaymentTests($Ctx) {
    $s1 = $Ctx.S1; $vid = $Ctx.Vid; $useTier = $Ctx.UseTier

    if (-not $RunInfo.StubBase) {
        Add-Result "T1-T5" "payment tests that need a successful charge" "applied, replay-safe, mismatch parked" "" "SKIP" "this run has no Paystack stub: the backend's PAYSTACK_BASE_URL must point at a stub service in the compose file"
        return
    }
    Write-Host "`n=== Payment tests driven by the Paystack stub (no browser, no tunnel) ===" -ForegroundColor Cyan

    # T1 a payment applies
    $pre = Get-State $vid
    $init = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier } | ConvertTo-Json -Compress)
    $ref = Get-Prop $init.Json "data.reference"
    if (-not $ref) {
        Add-Result "T1.1" "paying applies the payment" "ledger applied" "initiate $($init.Status)" "FAIL" "initiate failed"
    }
    else {
        $pay = Invoke-StubPay $ref "status=success&webhook=normal"
        $final = Wait-LedgerStatus $ref @("applied", "needs_review", "failed") 90
        Check "T1.1" "paying through the stub applies the payment" "ledger applied" "$final (stub answered $($pay.Status))" ($final -eq "applied")

        $led = Wait-LedgerAttempts $ref 30
        $attempts = 0
        if ($led) { $attempts = $led.Attempts }
        Check "T1.2" "the stub's webhook reached the backend" "webhook_attempts >= 1" "$attempts" ($attempts -ge 1)

        $post = Get-State $vid
        Check "T1.3" "one active subscription of the paid tier, vendor tier synced" "active=1, tier=$useTier" "active=$($post.Active), tier=$($post.Tier)" (($post.Active -eq 1) -and ($post.Tier -eq $useTier))

        $days = -1
        if ($post.Active -eq 1) { $days = Get-DaysUntilExpiry $vid $pre.Expiry }
        Check "T1.4" "expiry moved forward by about one month" "27 to 32 days" "$days days" (($days -ge 27) -and ($days -le 32))

        # T2 the same signed webhook delivered again changes nothing
        if ($final -eq "applied") {
            $rb = New-ChargeBody $ref $vid $Price[$useTier]
            $sig = Get-PaystackSignature $rb
            $b2 = Get-State $vid
            $a = Send-Webhook $rb $sig
            $c = Send-Webhook $rb $sig
            $a2 = Get-State $vid
            Check "T2.1" "re-delivered signed webhooks are acknowledged" "200 and 200" "$($a.Status) and $($c.Status)" (($a.Status -eq 200) -and ($c.Status -eq 200))
            Check "T2.2" "re-delivery does not extend or duplicate the subscription" "state identical" "same=$(Test-SameState $b2 $a2)" (Test-SameState $b2 $a2)
        }
    }

    # T5 a payment 100 kobo short of the price is parked for review
    $pre5 = Get-State $vid
    $init5 = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier } | ConvertTo-Json -Compress)
    $ref5 = Get-Prop $init5.Json "data.reference"
    if (-not $ref5) {
        Add-Result "T5.1" "an amount mismatch is parked for review" "needs_review" "initiate $($init5.Status)" "FAIL" "initiate failed"
        return
    }
    Assert-Guid $ref5 "reference"
    $short = [int64]$Price[$useTier] - 100
    $pay5 = Invoke-StubPay $ref5 "status=success&amount=$short&webhook=normal"
    $final5 = Wait-LedgerStatus $ref5 @("applied", "needs_review", "failed") 90
    $post5 = Get-State $vid
    $reason = Invoke-Sql "SELECT coalesce(review_reason, '') FROM subscription_payments WHERE reference = '$ref5'"
    Check "T5.1" "a payment 100 kobo short is parked for review" "needs_review" "$final5 (stub answered $($pay5.Status))" ($final5 -eq "needs_review")
    Check "T5.2" "the subscription is untouched" "state identical" "same=$(Test-SameState $pre5 $post5)" (Test-SameState $pre5 $post5)
    $vv = Invoke-Auth $s1 GET "/verify/$ref5"
    Check "T5.3" "the vendor is told the payment is under review" "409 PAYMENT_UNDER_REVIEW" "$($vv.Status) $(Get-Prop $vv.Json 'code')" (($vv.Status -eq 409) -and ((Get-Prop $vv.Json "code") -eq "PAYMENT_UNDER_REVIEW")) "review_reason: $reason"
}
