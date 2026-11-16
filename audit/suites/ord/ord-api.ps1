# audit/suites/ord/ord-api.ps1
# Helpers for the order API checks (P1): request bodies, the initialize call, database lookups for one order,
# and the "this must be rejected and write nothing" assertion. Dot-sourced after ord-helpers.ps1.

$script:OrdRateWaits = 0

function New-OrdEmail([string]$Label) {
    'audit-ord-{0}-{1}@example.com' -f $Label, [guid]::NewGuid().ToString('N').Substring(0, 8)
}

# One order line for a fixture tier.
function New-OrdLine($Ctx, [string]$TierName, [int]$Qty) {
    $t = $Ctx.Tiers[$TierName]
    @{ EventId = $t.EventId; TierId = $t.Id; Qty = $Qty }
}

# JSON body for POST /api/orders/initialize. $Extra overrides or adds top-level fields.
function New-OrdBody([object[]]$Lines, [string]$Email, [hashtable]$Extra = @{}) {
    $items = @()
    foreach ($l in $Lines) { $items += @{ eventId = $l.EventId; ticketTierId = $l.TierId; quantity = $l.Qty } }
    $b = [ordered]@{ email = $Email; firstName = 'Audit'; lastName = 'Orders'; phone = '08012345678'; items = $items }
    foreach ($k in $Extra.Keys) { $b[$k] = $Extra[$k] }
    $b | ConvertTo-Json -Compress -Depth 6
}

# POST /api/orders/initialize. A 429 comes from the rate limiter, not from the code under test, so it is waited out.
function Invoke-OrdInit($Session, [string]$Body, [switch]$NoCsrf, [hashtable]$Headers = @{}) {
    for ($i = 0; $i -le 6; $i++) {
        $r = Invoke-OrdApi $Session 'POST' '/api/orders/initialize' $Body -NoCsrf:$NoCsrf -Headers $Headers
        if ($r.Status -ne 429) { return $r }
        $script:OrdRateWaits++
        Write-Host '       rate limited (429); waiting 15 s' -ForegroundColor DarkGray
        Start-Sleep -Seconds 15
    }
    $r
}

function Reset-OrdState($Ctx) {
    $null = Invoke-OrdSqlFile (Join-Path $AuditDir 'sql\ord_reset.sql')
    foreach ($n in @($Ctx.Tiers.Keys)) { $Ctx.Tiers[$n] = Get-OrdTier $n }
}

# ---------------------------------------------------------------- what the database says about one order

function Get-OrdOrder([string]$Reference) {
    $sql = "SELECT o.id::text || '|' || o.status::text || '|' || o.subtotal || '|' || o.service_fee || '|' || o.vat_amount || '|' || o.final_total || '|' || o.amount_paid || '|' || coalesce(o.user_id::text, '') || '|' || coalesce(o.guest_id, '') || '|' || coalesce(o.paystack_fee, 0) || '|' || coalesce(o.app_profit, 0) || '|' || o.customer_email FROM orders o WHERE o.reference = {0}"
    $row = Invoke-Sql ($sql -f (Get-SqlLiteral $Reference))
    if (-not $row) { return $null }
    $p = $row -split '\|'
    [pscustomobject]@{
        Id = $p[0]; Status = $p[1]; Subtotal = [int64]$p[2]; ServiceFee = [int64]$p[3]; Vat = [int64]$p[4]; FinalTotal = [int64]$p[5]
        AmountPaid = [int64]$p[6]; UserId = $p[7]; GuestId = $p[8]; PaystackFee = [int64]$p[9]; AppProfit = [int64]$p[10]; Email = $p[11]
    }
}

function Get-OrdItems([string]$OrderId) {
    Assert-Guid $OrderId 'order id'
    $rows = Invoke-Sql "SELECT ticket_tier_id::text || '|' || quantity || '|' || unit_price || '|' || subtotal FROM order_items WHERE order_id = '$OrderId' ORDER BY ticket_tier_id"
    $out = @()
    foreach ($line in ($rows -split "`n")) {
        if ($line.Trim()) {
            $p = $line.Trim() -split '\|'
            $out += [pscustomobject]@{ TierId = $p[0]; Qty = [int]$p[1]; UnitPrice = [int64]$p[2]; Subtotal = [int64]$p[3] }
        }
    }
    $out
}

function Get-OrdSideEffects([string]$OrderId, [string]$Reference) {
    Assert-Guid $OrderId 'order id'
    $t = [int](Invoke-Sql "SELECT count(*) FROM tickets WHERE order_id = '$OrderId'")
    $m = [int](Invoke-Sql ("SELECT count(*) FROM email_outbox WHERE dedupe_key = {0}" -f (Get-SqlLiteral ('ticket:' + $Reference))))
    [pscustomobject]@{ Tickets = $t; Emails = $m }
}

# Orders and reserved tickets across everything ORD owns: the "nothing was written" yardstick.
function Get-OrdSnapshot {
    $scope = $script:OrdScope
    [pscustomobject]@{
        Orders = [int](Invoke-Sql "SELECT count(*) FROM orders o WHERE $scope")
        Sold   = [int](Invoke-Sql "SELECT coalesce(sum(t.sold), 0) FROM ticket_tiers t JOIN events e ON e.id = t.event_id WHERE e.event_title LIKE 'AUDIT-ORD%'")
    }
}

# Sends $Body and asserts: rejected (4xx, or the exact -Status / -Code) and nothing written (no order row, no stock held).
function Test-OrdRejected([string]$Id, [string]$Name, $Session, [string]$Body, [int[]]$Status = @(), [string]$Code = '', [string]$Finding = '', [hashtable]$Headers = @{}) {
    $s0 = Get-OrdSnapshot
    $r = Invoke-OrdInit $Session $Body -Headers $Headers
    $s1 = Get-OrdSnapshot
    $got = [string](Get-Prop $r.Json 'code')
    if ($Status.Count) { $statusOk = ($Status -contains $r.Status) } else { $statusOk = (($r.Status -ge 400) -and ($r.Status -lt 500)) }
    $codeOk = $true
    if ($Code) { $codeOk = ($got -eq $Code) }
    $clean = (($s1.Orders -eq $s0.Orders) -and ($s1.Sold -eq $s0.Sold))
    $ok = ($statusOk -and $codeOk -and $clean)
    $want = '4xx'
    if ($Status.Count) { $want = ($Status -join '/') }
    if ($Code) { $want += " $Code" }
    $shown = "$($r.Status)"
    if ($got) { $shown += " $got" }
    $note = ''
    if ((-not $ok) -and $Finding) { $note = "known finding $Finding" }
    Check $Id $Name "$want and nothing written" ("$shown, +{0} orders, +{1} sold" -f ($s1.Orders - $s0.Orders), ($s1.Sold - $s0.Sold)) $ok $note
}

# Sends $Count identical initialize requests at the same moment (PowerShell 7: ForEach-Object -Parallel + curl.exe).
# The guest identity travels as a cookie header; the initialize route needs no CSRF token.
function Invoke-OrdParallelInit($Guest, [string]$Body, [hashtable]$Headers, [int]$Count) {
    $bodyFile = Join-Path $Tmp ([guid]::NewGuid().ToString('N') + '.body')
    [IO.File]::WriteAllText($bodyFile, $Body, (New-Object Text.UTF8Encoding($false)))
    $hdr = @()
    foreach ($k in $Headers.Keys) { $hdr += @('-H', ('{0}: {1}' -f $k, $Headers[$k])) }
    $cookie = 'guest_id=' + [string]$Guest.GuestId
    $url = "$BaseUrl/api/orders/initialize"
    $dir = $Tmp
    1..$Count | ForEach-Object -Parallel {
        $h = $using:hdr
        $out = Join-Path $using:dir ([guid]::NewGuid().ToString('N') + '.out')
        $code = & curl.exe -s -S --max-time 60 -o $out -w '%{http_code}' -X POST -H 'Content-Type: application/json' -H 'ngrok-skip-browser-warning: 1' -b $using:cookie @h --data-binary "@$using:bodyFile" $using:url
        $json = $null
        try { $json = Get-Content -Raw -LiteralPath $out | ConvertFrom-Json } catch { }
        [pscustomobject]@{ Status = [int]$code; Json = $json }
    } -ThrottleLimit $Count
}

# The ORD events need an organizer and the cross-user checks need a buyer: the two audit accounts. ORD never invents
# accounts; the shared vendor seeder (audit\runner\seed-vendors-api.ps1, the one the SUB suite runs, idempotent) creates
# them. A rig database that was rebuilt has none, so run the seeder when they are missing instead of failing late.
function Confirm-OrdAccounts {
    $missing = @()
    foreach ($e in @($env:AUDIT_VENDOR_EMAIL, $env:AUDIT_VENDOR2_EMAIL)) {
        if ($e -and -not (Get-OrdUserId $e)) { $missing += $e }
    }
    if ($missing.Count -eq 0) { return }
    $seed = Join-Path $AuditDir 'runner\seed-vendors-api.ps1'
    if (-not (Test-Path -LiteralPath $seed)) { Stop-Setup "these audit accounts are missing from the database ($($missing -join ', ')) and $seed was not found to create them" }
    Write-Host "  missing from this database: $($missing -join ', '). Running the shared vendor seeder (idempotent)..." -ForegroundColor Yellow
    & $seed -BaseUrl "http://localhost:$Port" -CsrfCookie $CsrfCookie -CsrfHeader $CsrfHeader
    $still = @()
    foreach ($e in $missing) { if (-not (Get-OrdUserId $e)) { $still += $e } }
    if ($still.Count) { Stop-Setup "the vendor seeder ran but these accounts are still missing: $($still -join ', ')" }
    Add-Result 'ORD-A0' 'audit accounts were missing and have been created' 'accounts exist' ($missing -join ', ') 'INFO' 'The rig database had been rebuilt. The shared seeder created them.'
}
