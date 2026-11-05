# audit/matrix/manual.ps1
# Tests that need a real Paystack TEST payment (T1, T2, T5). Tunnel mode only.
# In rig mode the stub has no checkout page, so these are recorded as SKIP.

function Invoke-ManualPaymentTests($Ctx) {
    $s1 = $Ctx.S1; $vid = $Ctx.Vid; $useTier = $Ctx.UseTier

    if ($Rig) {
        Add-Result "T1-T5" "payment tests that need a successful charge" "applied, replay-safe, mismatch parked" "" "SKIP" "the stub has no checkout page; send audit\stub\paystack_stub.go so a 'mark paid' control can be wired in"
        return
    }

    Write-Host "`n=== Manual payment tests (you pay in the browser with a Paystack TEST card) ===" -ForegroundColor Cyan

    # T1 real payment
    $pre = Get-State $vid
    $init = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier } | ConvertTo-Json -Compress)
    $mref = Get-Prop $init.Json "data.reference"
    if (-not $mref) { Add-Result "T1.1" "real payment applies" "applied" "initiate $($init.Status)" "FAIL" "initiate failed" }
    else {
        Write-Host "`nOpen this URL and pay with a Paystack test card (see Paystack's test-card page):`n  $(Get-Prop $init.Json 'data.authorizationUrl')`nWaiting up to 10 minutes..." -ForegroundColor Yellow
        $final = Wait-LedgerStatus $mref @("applied", "needs_review", "failed") 600
        Check "T1.1" "paying through Paystack applies the payment" "ledger applied" $final ($final -eq "applied")

        $deadline = (Get-Date).AddSeconds(60); $led = Get-Ledger $mref
        while (($led.Attempts -lt 1) -and ((Get-Date) -lt $deadline)) { Start-Sleep -Seconds 3; $led = Get-Ledger $mref }
        Check "T1.2" "Paystack delivered the webhook through the tunnel" "webhook_attempts >= 1" "$($led.Attempts)" ($led.Attempts -ge 1)

        $post = Get-State $vid
        Check "T1.3" "one active subscription of the paid tier, vendor tier synced" "active=1, tier=$useTier" "active=$($post.Active), tier=$($post.Tier)" (($post.Active -eq 1) -and ($post.Tier -eq $useTier))

        $days = -1
        if ($post.Active -eq 1) { $days = Get-DaysUntilExpiry $vid $pre.Expiry }
        Check "T1.4" "expiry moved forward by about one month" "27 to 32 days" "$days days" (($days -ge 27) -and ($days -le 32))

        # T2 replay
        if ($final -eq "applied") {
            $rb = New-ChargeBody $mref $vid $Price[$useTier]
            $sig = Get-PaystackSignature $rb
            $b2 = Get-State $vid
            $a = Send-Webhook $rb $sig
            $c = Send-Webhook $rb $sig
            $a2 = Get-State $vid
            Check "T2.1" "re-delivered signed webhooks are acknowledged" "200 and 200" "$($a.Status) and $($c.Status)" (($a.Status -eq 200) -and ($c.Status -eq 200))
            Check "T2.2" "re-delivery does not extend or duplicate the subscription" "state identical" "same=$(Test-SameState $b2 $a2)" (Test-SameState $b2 $a2)
        }
    }

    # T5 tampered amount
    $pre5 = Get-State $vid
    $init = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier } | ConvertTo-Json -Compress)
    $tref = Get-Prop $init.Json "data.reference"
    if ($tref) {
        Assert-Guid $tref "reference"
        Invoke-Sql "UPDATE subscription_payments SET amount_kobo = amount_kobo + 100 WHERE reference = '$tref' AND status = 'initiated'" | Out-Null
        Write-Host "`nT5: the ledger now expects 100 kobo more than Paystack will charge. Pay with a test card:`n  $(Get-Prop $init.Json 'data.authorizationUrl')" -ForegroundColor Yellow
        $final5 = Wait-LedgerStatus $tref @("applied", "needs_review", "failed") 600
        $post5 = Get-State $vid
        $reason = Invoke-Sql "SELECT coalesce(review_reason, '') FROM subscription_payments WHERE reference = '$tref'"
        Check "T5.1" "an amount mismatch is parked for review" "needs_review" $final5 ($final5 -eq "needs_review")
        Check "T5.2" "the subscription is untouched" "state identical" "same=$(Test-SameState $pre5 $post5)" (Test-SameState $pre5 $post5)
        $vv = Invoke-Auth $s1 GET "/verify/$tref"
        Check "T5.3" "the vendor is told the payment is under review" "409 PAYMENT_UNDER_REVIEW" "$($vv.Status) $(Get-Prop $vv.Json 'code')" (($vv.Status -eq 409) -and ((Get-Prop $vv.Json "code") -eq "PAYMENT_UNDER_REVIEW")) "review_reason: $reason"
    }
    else { Add-Result "T5.1" "amount mismatch parked" "needs_review" "initiate $($init.Status)" "FAIL" "initiate failed" }
}