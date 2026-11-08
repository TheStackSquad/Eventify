# audit/suites/ord/checks-initialize.ps1
# ORD-I: POST /api/orders/initialize. What is written, what is rejected, what happens when the gateway fails.
# Known gaps are recorded as FAIL with "known finding F2xx". A thrown exception is a step failure.

function Test-OrdInitialize($Ctx) {
    $g = $Ctx.Guest
    $buyer = $Ctx.Buyer

    # ---------------------------------------------------------------- I1: a guest buys two small tickets
    $t0 = Get-OrdTier 'ord-std'
    $email = New-OrdEmail 'happy'
    $r = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 2) $email)
    $ref = [string](Get-Prop $r.Json 'data.reference')
    $oid = [string](Get-Prop $r.Json 'data.order_id')
    $amt = Get-Prop $r.Json 'data.amount_kobo'
    $url = [string](Get-Prop $r.Json 'data.authorization_url')
    $shape = (($r.Status -eq 201) -and [bool]$ref -and [bool]$oid -and ($null -ne $amt) -and [bool]$url)
    $shown = "$($r.Status)"
    if ($ref) { $shown += " $ref" }
    Check 'ORD-I1.1' 'a guest can start an order and gets a reference and a payment link' '201 with reference, order_id, amount_kobo, authorization_url' $shown $shape

    $o = $null
    if ($ref) { $o = Get-OrdOrder $ref }
    if (-not $o) {
        foreach ($id in 'ORD-I1.2', 'ORD-I1.3', 'ORD-I1.4', 'ORD-I1.5', 'ORD-I1.6') {
            Add-Result $id 'order row checks' '' '' 'SKIP' 'I1.1 produced no order; nothing was fabricated'
        }
    }
    else {
        $a = "status=$($o.Status) user=$(if ($o.UserId) { 'set' } else { 'none' }) guest_match=$($o.GuestId -eq [string]$g.GuestId) amount_paid=$($o.AmountPaid)"
        $ok = (($o.Status -eq 'pending') -and (-not $o.UserId) -and ($o.GuestId -eq [string]$g.GuestId) -and ($o.Email -eq $email) -and ($o.AmountPaid -eq 0) -and ($amt -eq $o.FinalTotal))
        Check 'ORD-I1.2' 'the order is stored pending, owned by the guest, unpaid, and the response amount matches' 'pending, guest_id = cookie, no user, amount_paid 0, amount_kobo = final_total' $a $ok

        $items = @(Get-OrdItems $o.Id)
        $itemOk = (($items.Count -eq 1) -and ($items[0].TierId -eq $t0.Id) -and ($items[0].Qty -eq 2) -and ($items[0].UnitPrice -eq $t0.PriceKobo) -and ($items[0].Subtotal -eq (2 * $t0.PriceKobo)) -and ($o.Subtotal -eq (2 * $t0.PriceKobo)))
        $itemShown = "$($items.Count) item(s)"
        if ($items.Count -ge 1) { $itemShown += ", qty $($items[0].Qty) at $($items[0].UnitPrice)" }
        Check 'ORD-I1.3' 'one order item at the server price, subtotal = price x quantity' "1 item, qty 2 at $($t0.PriceKobo)" $itemShown $itemOk

        $t1 = Get-OrdTier 'ord-std'
        Check 'ORD-I1.4' 'the two tickets are reserved (sold +2, available -2)' 'sold +2, available -2' ("sold +{0}, available {1}" -f ($t1.Sold - $t0.Sold), ($t1.Available - $t0.Available)) ((($t1.Sold - $t0.Sold) -eq 2) -and (($t1.Available - $t0.Available) -eq -2))

        $fx = Get-OrdSideEffects $o.Id $ref
        Check 'ORD-I1.5' 'no tickets and no email exist before payment' '0 tickets, 0 emails' "$($fx.Tickets) tickets, $($fx.Emails) emails" (($fx.Tickets -eq 0) -and ($fx.Emails -eq 0))

        if ($RunInfo.StubBase) {
            $sv = Get-StubVerify $ref
            $sst = [string](Get-Prop $sv.Json 'data.status')
            $sam = Get-Prop $sv.Json 'data.amount'
            $spt = [string](Get-Prop $sv.Json 'data.metadata.payment_type')
            $soi = [string](Get-Prop $sv.Json 'data.metadata.order_id')
            $stubOk = (($sv.Status -eq 200) -and ($sst -eq 'abandoned') -and ($sam -eq $o.FinalTotal) -and ($spt -eq 'ticket_purchase') -and ($soi -eq $oid))
            Check 'ORD-I1.6' 'the gateway was asked for the same amount, tagged ticket_purchase with the order id' 'abandoned, amount = final_total, payment_type ticket_purchase, order_id' "HTTP $($sv.Status), $sst, amount=$sam, type=$spt" $stubOk
        }
        else { Add-Result 'ORD-I1.6' 'the gateway was asked for the same amount' '' '' 'SKIP' 'tunnel mode has no stub to ask; the manual run covers real Paystack' }
    }

    # ---------------------------------------------------------------- I2: a logged-in buyer
    if ($buyer) {
        $e2 = New-OrdEmail 'buyer'
        $r2 = Invoke-OrdInit $buyer (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) $e2)
        $ref2 = [string](Get-Prop $r2.Json 'data.reference')
        $o2 = $null
        if ($ref2) { $o2 = Get-OrdOrder $ref2 }
        $buyerId = Get-OrdUserId $env:AUDIT_VENDOR2_EMAIL
        if ($o2) { Check 'ORD-I2.1' 'a logged-in buyer owns the order through user_id' '201 and user_id = the session user' "$($r2.Status), user match=$($o2.UserId -eq $buyerId)" (($r2.Status -eq 201) -and ($o2.UserId -eq $buyerId)) }
        else { Check 'ORD-I2.1' 'a logged-in buyer owns the order through user_id' '201 and user_id = the session user' "$($r2.Status), no order" $false }
    }
    else { Add-Result 'ORD-I2.1' 'a logged-in buyer owns the order through user_id' '' '' 'SKIP' 'needs AUDIT_VENDOR2_EMAIL and AUDIT_VENDOR2_PASSWORD' }

    # ---------------------------------------------------------------- I3, I9: identity and CSRF as designed (observations)
    $r3 = Invoke-OrdInit $null (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'nocookie'))
    Add-Result 'ORD-I3.1' 'a request with no cookies at all' 'observation' "$($r3.Status)" 'INFO' 'If 201: the backend gives every cookie-less call a fresh guest identity, so identity does not limit how many orders one client can open (see F207).'
    $r9 = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'nocsrf')) -NoCsrf
    Add-Result 'ORD-I3.2' 'a guest order without a CSRF token' 'observation' "$($r9.Status)" 'INFO' 'The route has no CSRF middleware by design (guest checkout).'

    # ---------------------------------------------------------------- I4: hostile and invalid input is rejected and writes nothing
    $base = New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'bad')
    Test-OrdRejected 'ORD-I4.1' 'malformed JSON is rejected' $g '{"email":' 
    Test-OrdRejected 'ORD-I4.2' 'a missing email is rejected' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) '')
    Test-OrdRejected 'ORD-I4.3' 'an invalid email is rejected' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) 'not-an-email')
    Test-OrdRejected 'ORD-I4.4' 'a missing first name is rejected' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'bad') @{ firstName = '' })
    Test-OrdRejected 'ORD-I4.5' 'an order with no items is rejected' $g (New-OrdBody @() (New-OrdEmail 'bad'))
    Test-OrdRejected 'ORD-I4.6' 'quantity 0 is rejected' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 0) (New-OrdEmail 'bad'))
    Test-OrdRejected 'ORD-I4.7' 'a negative quantity is rejected' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' -1) (New-OrdEmail 'bad'))
    Test-OrdRejected 'ORD-I4.8' 'more than 10 tickets in one line is rejected' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 11) (New-OrdEmail 'bad'))
    Test-OrdRejected 'ORD-I4.9' 'more than 10 tickets across two lines is rejected' $g (New-OrdBody @((New-OrdLine $Ctx 'ord-std' 6), (New-OrdLine $Ctx 'ord-prem' 5)) (New-OrdEmail 'bad'))
    Test-OrdRejected 'ORD-I4.10' 'a quantity that is not a number is rejected' $g ($base -replace '"quantity":1', '"quantity":"two"')
    Test-OrdRejected 'ORD-I4.11' 'a quantity beyond 32 bits is rejected' $g ($base -replace '"quantity":1', '"quantity":2147483648')
    $ghost = @{ EventId = $Ctx.Tiers['ord-std'].EventId; TierId = [guid]::NewGuid().ToString(); Qty = 1 }
    Test-OrdRejected 'ORD-I4.12' 'an unknown ticket tier is rejected' $g (New-OrdBody @($ghost) (New-OrdEmail 'bad'))
    $nilTier = @{ EventId = $Ctx.Tiers['ord-std'].EventId; TierId = '00000000-0000-0000-0000-000000000000'; Qty = 1 }
    Test-OrdRejected 'ORD-I4.13' 'a nil ticket tier id is rejected' $g (New-OrdBody @($nilTier) (New-OrdEmail 'bad'))
    Test-OrdRejected 'ORD-I4.14' 'a first name longer than the column (300 characters) is rejected, not a server error' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'bad') @{ firstName = ('a' * 300) }) -Finding 'F220'
    Test-OrdRejected 'ORD-I4.15' 'a phone number longer than the column (25 characters) is rejected, not a server error' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'bad') @{ phone = ('1' * 25) }) -Finding 'F220'

    # a stranger's user id in the body must not become the owner
    $e13 = New-OrdEmail 'inject'
    $r13 = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) $e13 @{ userId = $Ctx.OrganizerId })
    $ref13 = [string](Get-Prop $r13.Json 'data.reference')
    $o13 = $null
    if ($ref13) { $o13 = Get-OrdOrder $ref13 }
    if ($o13) { Check 'ORD-I4.16' 'the owner comes from the session, not from userId in the body' '201 and no user_id on the order' "$($r13.Status), user=$(if ($o13.UserId) { 'set to the body value' } else { 'none' })" (($r13.Status -eq 201) -and (-not $o13.UserId)) }
    else { Check 'ORD-I4.16' 'the owner comes from the session, not from userId in the body' '201 and no user_id on the order' "$($r13.Status), no order" $false }

    # quotes and SQL text in a name are stored as plain text
    $evil = "Robert'); DROP TABLE orders;--"
    $e14 = New-OrdEmail 'quote'
    $r14 = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) $e14 @{ firstName = $evil })
    $ref14 = [string](Get-Prop $r14.Json 'data.reference')
    $stored = ''
    if ($ref14) { $stored = Invoke-Sql ("SELECT customer_first_name FROM orders WHERE reference = {0}" -f (Get-SqlLiteral $ref14)) }
    Check 'ORD-I4.17' 'quotes and SQL in a name are stored as plain text' '201 and the same text back' "$($r14.Status), round trip=$($stored -ceq $evil)" (($r14.Status -eq 201) -and ($stored -ceq $evil))

    # ---------------------------------------------------------------- I5: stock
    $s0 = Get-OrdSnapshot
    $r5 = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-one' 1) (New-OrdEmail 'last1'))
    $s1 = Get-OrdSnapshot
    Check 'ORD-I5.1' 'the last single ticket can be reserved' '201, +1 order, +1 sold' ("$($r5.Status), +{0} orders, +{1} sold" -f ($s1.Orders - $s0.Orders), ($s1.Sold - $s0.Sold)) (($r5.Status -eq 201) -and (($s1.Orders - $s0.Orders) -eq 1) -and (($s1.Sold - $s0.Sold) -eq 1))
    Test-OrdRejected 'ORD-I5.2' 'a sold-out tier is refused' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-one' 1) (New-OrdEmail 'last2')) -Status 409 -Code 'SOLD_OUT'
    Test-OrdRejected 'ORD-I5.3' 'asking for more than is left (6 of 5) reserves nothing' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-last' 6) (New-OrdEmail 'over')) -Status 409 -Code 'SOLD_OUT'
    Test-OrdRejected 'ORD-I5.4' 'two lines that together exceed the stock (3 + 3 of 5) are refused atomically' $g (New-OrdBody @((New-OrdLine $Ctx 'ord-last' 3), (New-OrdLine $Ctx 'ord-last' 3)) (New-OrdEmail 'split')) -Status 409 -Code 'SOLD_OUT'

    # ---------------------------------------------------------------- I6: the gateway fails at initialize (rig: the stub injects the fault)
    if ($RunInfo.StubBase) {
        try {
            foreach ($mode in '502', '429', 'malformed') {
                $null = Invoke-Http -Method GET -Url "$($RunInfo.StubBase)/__fault?endpoint=initialize&mode=$mode&count=1"
                $em = New-OrdEmail "gw$mode"
                $b0 = Get-OrdTier 'ord-std'
                $rg = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) $em)
                $b1 = Get-OrdTier 'ord-std'
                $st = Invoke-Sql ("SELECT coalesce((SELECT status::text FROM orders WHERE customer_email = {0} ORDER BY created_at DESC LIMIT 1), 'no row')" -f (Get-SqlLiteral $em))
                $gc = [string](Get-Prop $rg.Json 'code')
                $gOk = (($rg.Status -eq 503) -and ($gc -eq 'PAYMENT_UNAVAILABLE') -and ($st -eq 'failed') -and ($b1.Sold -eq $b0.Sold))
                Check "ORD-I6.$mode" "gateway fault '$mode' on initialize: 503, order closed, tickets given back" '503 PAYMENT_UNAVAILABLE, order failed, sold unchanged' "$($rg.Status) $gc, order=$st, sold +$($b1.Sold - $b0.Sold)" $gOk
            }
        }
        finally { $null = Invoke-Http -Method GET -Url "$($RunInfo.StubBase)/__fault?mode=clear" }
    }
    else { Add-Result 'ORD-I6' 'gateway faults at initialize' '' '' 'SKIP' 'rig mode only: the stub injects the faults' }

    # ---------------------------------------------------------------- I7: the same submit twice (F207)
    $key = 'ord-p1a-' + [guid]::NewGuid().ToString('N')
    $dupBody = New-OrdBody @(New-OrdLine $Ctx 'ord-std' 1) (New-OrdEmail 'idem')
    $d0 = Get-OrdTier 'ord-std'
    $ra = Invoke-OrdInit $g $dupBody -Headers @{ 'Idempotency-Key' = $key }
    $rb = Invoke-OrdInit $g $dupBody -Headers @{ 'Idempotency-Key' = $key }
    $d1 = Get-OrdTier 'ord-std'
    $refA = [string](Get-Prop $ra.Json 'data.reference')
    $refB = [string](Get-Prop $rb.Json 'data.reference')
    $same = ([bool]$refA -and ($refA -eq $refB))
    Check-OrdFinding 'ORD-I7.1' 'the same submit twice with one Idempotency-Key opens one order' 'one reference, stock reserved once' ("same reference=$same, reserved $($d1.Sold - $d0.Sold) ticket(s)") ($same -and (($d1.Sold - $d0.Sold) -eq 1)) 'F207'

    # ---------------------------------------------------------------- I10, I11: events that should not sell, and a free ticket
    Test-OrdRejected 'ORD-I10.1' 'an event that already ended cannot be bought' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-ended' 1) (New-OrdEmail 'ended')) -Finding 'F216'
    Test-OrdRejected 'ORD-I10.2' 'a deleted event cannot be bought' $g (New-OrdBody @(New-OrdLine $Ctx 'ord-deleted' 1) (New-OrdEmail 'deleted')) -Finding 'F216'
    $f0 = Get-OrdTier 'ord-free'
    $rf = Invoke-OrdInit $g (New-OrdBody @(New-OrdLine $Ctx 'ord-free' 1) (New-OrdEmail 'free'))
    $f1 = Get-OrdTier 'ord-free'
    $fcode = [string](Get-Prop $rf.Json 'code')
    $freeOk = ($rf.Status -lt 500)
    Check-OrdFinding 'ORD-I11.1' 'a free ticket is either issued without payment or refused with a clear 4xx, never a server error' '201 (free flow) or 4xx' "$($rf.Status) $fcode, sold +$($f1.Sold - $f0.Sold)" $freeOk 'F215'

    Test-OrdInvariants 'ORD-I99' 'stock, tickets, emails and totals still agree after the initialize checks'
}
