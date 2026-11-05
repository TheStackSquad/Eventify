# audit/matrix/checks.ps1
# The automated checks, one function per test group. Each takes the shared run context $Ctx
# ($Ctx.S1/S2 sessions, $Ctx.Vid vendor id, $Ctx.UseTier tier to pay for, $Ctx.Reach plans response).
# A failed check is recorded as FAIL and the run continues. A thrown exception (database or
# network problem) is a step failure and is reported by Invoke-Step.

# T13 public plans
function Test-PublicPlans($Ctx) {
    $plans = Get-Prop $Ctx.Reach.Json "data"
    $pricesOk = $false
    $seen = ""
    if ($plans -and @($plans).Count -eq 3) {
        $pricesOk = $true
        $pairs = @()
        foreach ($p in @($plans)) {
            $tier = [string](Get-Prop $p "tier"); $kobo = Get-Prop $p "priceKobo"
            $pairs += "$tier=$kobo"
            if ($Price[$tier] -ne [int64]$kobo) { $pricesOk = $false }
        }
        $seen = $pairs -join ", "
    }
    Check "T13.1" "public plans match the server price table" "basic=350000, premium=1000000, featured=2500000" $seen $pricesOk
}

# T12 authentication and CSRF
function Test-AuthAndCsrf($Ctx) {
    $s1 = $Ctx.S1

    $r = Invoke-Http -Method POST -Url "$Sub/initiate" -Body '{"tier":"basic"}'
    Check "T12.1" "initiate without a session is rejected" "401" "$($r.Status)" ($r.Status -eq 401)
    $r = Invoke-Http -Method GET -Url "$Sub/verify/00000000-0000-0000-0000-000000000000"
    Check "T12.2" "verify without a session is rejected" "401" "$($r.Status)" ($r.Status -eq 401)
    $n0 = Get-LedgerCount
    $r = Invoke-Auth $s1 POST "/initiate" '{"tier":"basic"}' -NoCsrf
    $n1 = Get-LedgerCount
    Check "T12.3" "initiate with a session but no CSRF token is rejected" "403 and no ledger row" "$($r.Status), +$($n1 - $n0) rows" (($r.Status -eq 403) -and ($n1 -eq $n0))
}

# T10 input validation
function Test-InputValidation($Ctx) {
    $s1 = $Ctx.S1; $vid = $Ctx.Vid; $useTier = $Ctx.UseTier

    $allOk = $true; $detail = @()
    foreach ($bad in @("free", "platinum", "", "PREMIUM")) {
        $n0 = Get-LedgerCount
        $r = Invoke-Auth $s1 POST "/initiate" (@{ tier = $bad } | ConvertTo-Json -Compress)
        $n1 = Get-LedgerCount
        $detail += "'$bad'->$($r.Status)/+$($n1 - $n0)"
        if (($r.Status -ne 400) -or ($n1 -ne $n0)) { $allOk = $false }
    }
    Check "T10.1" "free, unknown and malformed tiers rejected, nothing written" "400 and +0 rows for each" ($detail -join " ") $allOk

    $stranger = [guid]::NewGuid().ToString()
    $r = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier; vendor_id = $stranger; vendorId = $stranger } | ConvertTo-Json -Compress)
    $injRef = Get-Prop $r.Json "data.reference"
    $injRow = $null
    if ($injRef) { $injRow = Get-Ledger $injRef }
    $injVendor = "no row"
    if ($injRow) { $injVendor = $injRow.VendorId }
    Check "T10.2" "the vendor comes from the session, not the request body" "201 and ledger vendor = session vendor" "$($r.Status), $injVendor" (($r.Status -eq 201) -and $injRow -and ($injRow.VendorId -eq $vid))
}

# T9 initiate and do not pay, T3 signatures, T9b lying webhook, T8 ownership
function Test-UnpaidPaymentFlow($Ctx) {
    $s1 = $Ctx.S1; $s2 = $Ctx.S2; $vid = $Ctx.Vid; $useTier = $Ctx.UseTier

    $before = Get-State $vid
    $init = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier } | ConvertTo-Json -Compress)
    $ref = Get-Prop $init.Json "data.reference"
    $payUrl = [string](Get-Prop $init.Json "data.authorizationUrl")
    $urlOk = $true
    if (-not $Rig) { $urlOk = ($payUrl -like "https://checkout.paystack.com/*") }
    $urlWant = "201 and a checkout URL"
    if (-not $Rig) { $urlWant = "201 and https://checkout.paystack.com/..." }
    Check "T9.1" "initiate returns a reference and a checkout URL" $urlWant "$($init.Status)" (($init.Status -eq 201) -and $ref -and $payUrl -and $urlOk)

    if (-not $ref) {
        foreach ($id in "T9.2", "T9.3", "T9.4", "T9.5", "T9b.1", "T9b.2", "T3.1", "T3.2", "T3.3", "T8.1") {
            Add-Result $id "needs a real reference from T9.1" "" "" "SKIP" "initiate failed; no reference was fabricated"
        }
        return
    }

    $led = Get-Ledger $ref
    $ledText = "no row"
    if ($led) { $ledText = "$($led.Status) $($led.AmountKobo) attempts=$($led.Attempts)" }
    Check "T9.2" "ledger row written before payment" "initiated, server price, session vendor, no webhook yet" $ledText (($led -ne $null) -and ($led.Status -eq "initiated") -and ($led.AmountKobo -eq $Price[$useTier]) -and ($led.VendorId -eq $vid) -and ($led.Attempts -eq 0))
    $afterInit = Get-State $vid
    Check "T9.3" "no pending subscription row is created" "subscription rows unchanged" "$($before.Subs) -> $($afterInit.Subs)" ($afterInit.Subs -eq $before.Subs)

    # T3 signature checks (run before T9b so the attempts counter is still 0)
    $body = New-ChargeBody $ref $vid $Price[$useTier]
    $w1 = Send-Webhook $body "deadbeef"
    $w2 = Send-Webhook $body ""
    $w3 = Send-Webhook $body (Get-PaystackSignature ($body + " "))
    $led = Get-Ledger $ref
    Check "T3.1" "wrong signature rejected" "401" "$($w1.Status)" ($w1.Status -eq 401)
    Check "T3.2" "missing signature rejected" "401" "$($w2.Status)" ($w2.Status -eq 401)
    Check "T3.3" "valid HMAC of a different body rejected and not counted" "401 and attempts = 0" "$($w3.Status), attempts=$($led.Attempts)" (($w3.Status -eq 401) -and ($led.Attempts -eq 0))

    # Is the gateway (or stub) itself reporting this reference as unpaid?
    $skipUnpaid = $false
    if ($RunInfo.StubBase) {
        $sp = Get-StubVerify $ref
        $stubStatus = [string](Get-Prop $sp.Json "data.status")
        $o6 = "INFO"
        if ($stubStatus -eq "success") { $o6 = "FAIL"; $skipUnpaid = $true }
        Add-Result "S6" "stub reports the new reference as unpaid" "abandoned, pending or not found" "HTTP $($sp.Status), data.status='$stubStatus'" $o6
    }

    if ($skipUnpaid) {
        foreach ($id in "T9.4", "T9.5", "T9b.1", "T9b.2") {
            Add-Result $id "unpaid-reference checks" "" "" "SKIP" "the stub reports this reference as paid (S6), so the result would be meaningless"
        }
    }
    else {
        $v = Invoke-Auth $s1 GET "/verify/$ref"
        Check "T9.4" "verify on an unpaid reference is refused" "422 PAYMENT_NOT_SUCCESSFUL" "$($v.Status) $(Get-Prop $v.Json 'code')" (($v.Status -eq 422) -and ((Get-Prop $v.Json "code") -eq "PAYMENT_NOT_SUCCESSFUL"))
        $afterVerify = Get-State $vid
        $led = Get-Ledger $ref
        Check "T9.5" "verify changed nothing" "ledger still initiated, subscription state identical" "$($led.Status); same=$(Test-SameState $before $afterVerify)" (($led.Status -eq "initiated") -and (Test-SameState $before $afterVerify))

        # T9b a correctly signed webhook that lies about success
        $w = Send-Webhook $body (Get-PaystackSignature $body)
        $afterHook = Get-State $vid
        $led = Get-Ledger $ref
        Check "T9b.1" "signed webhook claiming success for an unpaid transaction is acknowledged" "200" "$($w.Status)" ($w.Status -eq 200)
        Check "T9b.2" "it changes nothing and is counted" "ledger initiated, state identical, attempts >= 1" "$($led.Status); same=$(Test-SameState $before $afterHook); attempts=$($led.Attempts)" (($led.Status -eq "initiated") -and (Test-SameState $before $afterHook) -and ($led.Attempts -ge 1))
    }

    # T8 ownership
    if ($s2) {
        $o = Invoke-Auth $s2 GET "/verify/$ref"
        Check "T8.1" "another vendor cannot verify this payment" "404 PAYMENT_NOT_FOUND" "$($o.Status) $(Get-Prop $o.Json 'code')" (($o.Status -eq 404) -and ((Get-Prop $o.Json "code") -eq "PAYMENT_NOT_FOUND"))
    }
    else { Add-Result "T8.1" "another vendor cannot verify this payment" "404" "" "SKIP" "set AUDIT_VENDOR2_EMAIL and AUDIT_VENDOR2_PASSWORD" }
}

# T3c unknown reference
function Test-UnknownReference($Ctx) {
    $ghost = [guid]::NewGuid().ToString()
    $gb = New-ChargeBody $ghost $Ctx.Vid 1000000
    $l0 = Get-LedgerCount; $c0 = Get-SubscriptionCount
    $r = Send-Webhook $gb (Get-PaystackSignature $gb)
    $l1 = Get-LedgerCount; $c1 = Get-SubscriptionCount
    Check "T3c.1" "signed webhook for an unknown reference is acknowledged, no side effects" "200 and no new rows" "$($r.Status), +$($l1 - $l0) ledger, +$($c1 - $c0) subscriptions" (($r.Status -eq 200) -and ($l1 -eq $l0) -and ($c1 -eq $c0))
}

# T16 oversized body
function Test-OversizedBody($Ctx) {
    $big = "x" * 2097152
    $r = Send-Webhook $big "deadbeef"
    $outcome = "FAIL"
    if (@(400, 413) -contains $r.Status) { $outcome = "PASS" } elseif ($r.Status -eq 401) { $outcome = "INFO" }
    Add-Result "T16.1" "2 MB webhook body" "400 or 413 (size cap)" "$($r.Status)" $outcome
}

# T17 hostile references
function Test-HostileReferences($Ctx) {
    $s1 = $Ctx.S1
    $ok17 = $true; $d17 = @()
    foreach ($h in @("%27%20OR%201%3D1--", ("A" * 2000), "..%2F..%2Fetc%2Fpasswd", "00000000-0000-0000-0000-000000000000")) {
        $r = Invoke-Auth $s1 GET "/verify/$h"
        $d17 += "$($r.Status)"
        if (-not (($r.Status -ge 400) -and ($r.Status -lt 500))) { $ok17 = $false }
    }
    Check "T17.1" "hostile references produce 4xx, never 5xx" "4xx for each" ($d17 -join " ") $ok17
}

# T7 tier switch while active
function Test-TierSwitch($Ctx) {
    $s1 = $Ctx.S1; $vid = $Ctx.Vid
    $activeNow = Invoke-Sql "SELECT coalesce(max(tier), '') FROM subscriptions WHERE vendor_id = '$vid' AND status = 'active'"
    if ($activeNow) {
        $other = "basic"
        if ($activeNow -eq "basic") { $other = "premium" }
        $n0 = Get-LedgerCount
        $r = Invoke-Auth $s1 POST "/initiate" (@{ tier = $other } | ConvertTo-Json -Compress)
        $n1 = Get-LedgerCount
        Check "T7.1" "a different tier is refused while a plan is active" "409 ACTIVE_PLAN_EXISTS and +0 rows" "$($r.Status) $(Get-Prop $r.Json 'code') +$($n1 - $n0)" (($r.Status -eq 409) -and ((Get-Prop $r.Json "code") -eq "ACTIVE_PLAN_EXISTS") -and ($n1 -eq $n0))
    }
    else { Add-Result "T7.1" "a different tier is refused while a plan is active" "409" "" "SKIP" "needs an active plan (a real paid test in tunnel mode, or a stub control endpoint in rig mode)" }
}

# T15 optional burst
function Test-RateLimit($Ctx) {
    $s1 = $Ctx.S1; $useTier = $Ctx.UseTier
    $codes = @{}
    for ($i = 0; $i -lt $Burst; $i++) {
        $r = Invoke-Auth $s1 POST "/initiate" (@{ tier = $useTier } | ConvertTo-Json -Compress)
        $k = "$($r.Status)"
        if ($codes.ContainsKey($k)) { $codes[$k] = $codes[$k] + 1 } else { $codes[$k] = 1 }
    }
    $summary = ($codes.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join " "
    $o = "INFO"
    if ($codes.ContainsKey("429")) { $o = "PASS" }
    Add-Result "T15.1" "burst of $Burst initiate calls" "rate limiting engages (429)" $summary $o
}