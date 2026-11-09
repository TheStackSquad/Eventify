# audit/suites/ord/fixtures-ord.ps1
# ORD fixtures. P0 reuses the two existing audit accounts (read-only, nothing new to register):
#   AUDIT_VENDOR_EMAIL   organizes the AUDIT-ORD events and is the "organizer" session
#   AUDIT_VENDOR2_EMAIL  is the logged-in "buyer" session (optional; cross-user checks are skipped without it)
# Dedicated customer accounts come later, once the signup payload is confirmed.

$script:OrdEvents = [ordered]@{
    main    = 'a0d17000-0000-4000-8000-000000000001'
    second  = 'a0d17000-0000-4000-8000-000000000002'
    ended   = 'a0d17000-0000-4000-8000-000000000003'
    deleted = 'a0d17000-0000-4000-8000-000000000004'
}
$script:OrdTierNames = @('ord-std', 'ord-prem', 'ord-edge-lo', 'ord-edge-hi', 'ord-free', 'ord-last', 'ord-one', 'ord-b-std', 'ord-ended', 'ord-deleted')

function Get-OrdTier([string]$Name) {
    $row = Invoke-Sql ("SELECT t.id || '|' || t.event_id || '|' || t.price_kobo || '|' || t.capacity || '|' || t.sold || '|' || t.available FROM ticket_tiers t JOIN events e ON e.id = t.event_id WHERE t.name = {0} AND e.event_title LIKE 'AUDIT-ORD%' LIMIT 1" -f (Get-SqlLiteral $Name))
    if (-not $row) { return $null }
    $p = $row -split '\|'
    [pscustomobject]@{ Name = $Name; Id = $p[0]; EventId = $p[1]; PriceKobo = [int64]$p[2]; Capacity = [int]$p[3]; Sold = [int]$p[4]; Available = [int]$p[5] }
}

function Initialize-OrdFixtures($Ctx) {
    $uid = Get-OrdUserId $env:AUDIT_VENDOR_EMAIL
    if ($uid -notmatch '^[0-9a-fA-F-]{36}$') { Stop-Setup 'AUDIT_VENDOR_EMAIL has no account in this database; the ORD events need an organizer' }
    $Ctx.OrganizerId = $uid

    if ($Reset) {
        $null = Invoke-OrdSqlFile (Join-Path $AuditDir 'sql\ord_reset.sql')
        Add-Result 'ORD-F0' 'ORD data reset' 'ORD orders, tickets and ticket emails removed, tiers restocked' 'done' 'INFO'
    }
    $null = Invoke-OrdSqlFile (Join-Path $AuditDir 'sql\ord_seed.sql') @{ organizer_id = $uid }

    $Ctx.Events = $script:OrdEvents
    $Ctx.Tiers = @{}
    foreach ($n in $script:OrdTierNames) {
        $t = Get-OrdTier $n
        if (-not $t) { Stop-Setup "fixture tier '$n' is missing after seeding" }
        $Ctx.Tiers[$n] = $t
    }
    Add-Result 'ORD-F1' 'fixtures ready' '4 events, 10 tiers' ("{0} events, {1} tiers" -f $Ctx.Events.Count, $Ctx.Tiers.Count) 'INFO'
}

function New-OrdSessions($Ctx) {
    $Ctx.Organizer = New-Session $env:AUDIT_VENDOR_EMAIL $env:AUDIT_VENDOR_PASSWORD 'organizer'
    $me = Invoke-Http -Method GET -Url "$BaseUrl/auth/me" -Jar $Ctx.Organizer.Jar
    Check 'ORD-A2' 'organizer session works' '200 on /auth/me' "$($me.Status)" ($me.Status -eq 200)
    if ($me.Status -ne 200) { Stop-Setup "the organizer session is not accepted by /auth/me (HTTP $($me.Status))" }

    $Ctx.Buyer = $null
    if ($env:AUDIT_VENDOR2_EMAIL -and $env:AUDIT_VENDOR2_PASSWORD) {
        $Ctx.Buyer = New-Session $env:AUDIT_VENDOR2_EMAIL $env:AUDIT_VENDOR2_PASSWORD 'buyer'
        $m2 = Invoke-Http -Method GET -Url "$BaseUrl/auth/me" -Jar $Ctx.Buyer.Jar
        Check 'ORD-A3' 'buyer session works' '200 on /auth/me' "$($m2.Status)" ($m2.Status -eq 200)
    }
    else { Add-Result 'ORD-A3' 'buyer session works' '200 on /auth/me' '' 'SKIP' 'set AUDIT_VENDOR2_EMAIL and AUDIT_VENDOR2_PASSWORD for the logged-in buyer and cross-user checks' }

    $Ctx.Guest = New-OrdGuest 'guest1'
    $gid = [string]$Ctx.Guest.GuestId
    $outcome = 'INFO'
    if ($gid) { $outcome = 'PASS' }
    Add-Result 'ORD-A4' 'a guest gets an identity cookie' 'guest_id cookie issued' $(if ($gid) { 'issued' } else { 'not issued' }) $outcome 'Guest checkout and guest-owned verify depend on this cookie.'
}
