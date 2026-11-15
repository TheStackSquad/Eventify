# audit/suites/ord/checks-pricing.ps1
# ORD-P: the server prices every order from its own tables. These checks recompute the expected fee, VAT, total and
# Paystack fee independently (same constants as backend/pkg/models/order.go) and compare them with what the API
# returned and what the database stored. Tiers: 300000 / 1000000 / 500000 / 500001 kobo (see ord_seed.sql).

function Get-OrdExpectedTotals([int64]$Sub) {
    $mode = [MidpointRounding]::AwayFromZero          # Go's math.Round rounds halves away from zero
    if ($Sub -le 500000) {
        $fee = [int64][math]::Round([double]$Sub * 0.10, $mode)
        $vat = [int64]0
    }
    else {
        $fee = [int64][math]::Round(([double]$Sub * 0.07) + 5000, $mode)
        $vat = [int64][math]::Round([double]$fee * 0.075, $mode)
    }
    $total = $Sub + $fee + $vat
    $pf = [int64][math]::Round(([double]$total * 0.015) + 10000, $mode)
    [pscustomobject]@{ Sub = $Sub; Fee = $fee; Vat = $vat; Total = $total; PaystackFee = $pf }
}

function Test-OrdPricing($Ctx) {
    $g = $Ctx.Guest
    $cases = @(
        @{ Key = 'std1';    Label = '1 x 3,000 naira';                Lines = @(,@('ord-std', 1)) },
        @{ Key = 'std2';    Label = '2 x 3,000 naira (6,000 subtotal)'; Lines = @(,@('ord-std', 2)) },
        @{ Key = 'prem';    Label = '1 x 10,000 naira';               Lines = @(,@('ord-prem', 1)) },
        @{ Key = 'edgelo';  Label = '1 x 5,000.00 naira (threshold)'; Lines = @(,@('ord-edge-lo', 1)) },
        @{ Key = 'edgehi';  Label = '1 x 5,000.01 naira';             Lines = @(,@('ord-edge-hi', 1)) },
        @{ Key = 'multi';   Label = '3,000 + 2,000 naira, two events'; Lines = @(@('ord-std', 1), @('ord-b-std', 1)) },
        @{ Key = 'std10';   Label = '10 x 3,000 naira (the cap)';     Lines = @(,@('ord-std', 10)) }
    )
    $seen = @{}
    $n = 0
    foreach ($c in $cases) {
        $n++
        $lines = @()
        $sub = [int64]0
        foreach ($l in $c.Lines) {
            $lines += , (New-OrdLine $Ctx $l[0] $l[1])
            $sub += $Ctx.Tiers[$l[0]].PriceKobo * $l[1]
        }
        $exp = Get-OrdExpectedTotals $sub
        $r = Invoke-OrdInit $g (New-OrdBody $lines (New-OrdEmail "p$($c.Key)"))
        $ref = [string](Get-Prop $r.Json 'data.reference')
        $amt = Get-Prop $r.Json 'data.amount_kobo'
        $o = $null
        if ($ref) { $o = Get-OrdOrder $ref }
        if (-not $o) {
            Add-Result "ORD-P$n.1" "$($c.Label): priced by the server" '' '' 'SKIP' "initialize returned $($r.Status); no order to compare"
            continue
        }
        $seen[$c.Key] = [pscustomobject]@{ Exp = $exp; Order = $o }
        $rowOk = (($o.Subtotal -eq $exp.Sub) -and ($o.ServiceFee -eq $exp.Fee) -and ($o.Vat -eq $exp.Vat) -and ($o.FinalTotal -eq $exp.Total) -and ($o.AmountPaid -eq 0))
        $respOk = ($amt -eq $exp.Total)
        $extra = [math]::Round(100.0 * ($exp.Total - $exp.Sub) / $exp.Sub, 1)
        Check "ORD-P$n.1" "$($c.Label): fee, VAT and total match the model, and the response amount equals the stored total" "sub $($exp.Sub) + fee $($exp.Fee) + vat $($exp.Vat) = $($exp.Total)" "sub $($o.Subtotal) + fee $($o.ServiceFee) + vat $($o.Vat) = $($o.FinalTotal); response $amt ($extra% on top)" ($rowOk -and $respOk)
        Check "ORD-P$n.2" "$($c.Label): the stored Paystack fee estimate is 1.5% + 100 naira" "$($exp.PaystackFee)" "$($o.PaystackFee)" ($o.PaystackFee -eq $exp.PaystackFee)
        if ($exp.Vat -gt 0) {
            $wantProfit = $o.ServiceFee - $o.PaystackFee
            Check-OrdFinding "ORD-P$n.3" "$($c.Label): app_profit leaves VAT out (VAT is owed to the tax authority, it is not profit)" "service_fee - paystack_fee = $wantProfit" "$($o.AppProfit)" ($o.AppProfit -eq $wantProfit) 'F210'
        }
    }

    # F209: a dearer ticket must never cost the customer less in total
    if ($seen.ContainsKey('edgelo') -and $seen.ContainsKey('edgehi')) {
        $lo = $seen['edgelo'].Order.FinalTotal
        $hi = $seen['edgehi'].Order.FinalTotal
        Check-OrdFinding 'ORD-P8.1' 'a ticket one kobo above the 5,000 naira threshold does not cost less than one exactly at it' "total(500001) >= total(500000)" "total(500001) = $hi, total(500000) = $lo" ($hi -ge $lo) 'F209'
    }
    else { Add-Result 'ORD-P8.1' 'fee tier boundary is monotonic' '' '' 'SKIP' 'the boundary orders were not created' }

    # Business observation: the fee tier applies to the whole order subtotal, so order size changes the rate
    if ($seen.ContainsKey('std1') -and $seen.ContainsKey('std2')) {
        $one = $seen['std1'].Order.FinalTotal
        $two = $seen['std2'].Order.FinalTotal
        Add-Result 'ORD-P8.2' 'two 3,000 naira tickets: one order vs two orders' 'observation' "one order of 2 = $two; two orders of 1 = $(2 * $one)" 'INFO' 'The tier uses the order subtotal, so one larger order pays a lower rate than two small ones. Decide whether that is intended before changing the fee model (P2).'
    }

    Test-OrdInvariants 'ORD-P99' 'stock, tickets, emails and totals still agree after the pricing checks'
}
