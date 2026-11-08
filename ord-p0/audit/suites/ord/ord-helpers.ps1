# audit/suites/ord/ord-helpers.ps1
# ORD helpers. Dot-sourced by orchestrate-ord.ps1 AFTER matrix\helpers.ps1 and matrix\setup.ps1, which are only
# READ: Check, Add-Result, Invoke-Http, Invoke-Sql, Invoke-NativeCapture, Get-SqlLiteral, Assert-Guid,
# Get-CookieValue, New-Session, Stop-Setup. Nothing here edits them.

function Assert-OrdSafety {
    foreach ($v in 'PAYSTACK_SECRET_KEY', 'AUDIT_DB_URL', 'AUDIT_VENDOR_EMAIL', 'AUDIT_VENDOR_PASSWORD') {
        if (-not [Environment]::GetEnvironmentVariable($v)) { Stop-Setup "environment variable $v is not set" }
    }
    foreach ($v in 'AUDIT_VENDOR_EMAIL', 'AUDIT_VENDOR2_EMAIL') {
        $val = [Environment]::GetEnvironmentVariable($v)
        if ($val -and ($val -notmatch '^[^@\s"'']+@[^@\s"'']+$')) { Stop-Setup "$v does not look like a plain email address: [$val]" }
    }
    if (-not $env:PAYSTACK_SECRET_KEY.StartsWith('sk_test_')) { Stop-Setup 'the Paystack secret key is not a test key; refusing to run' }
    if ($env:AUDIT_DB_URL -notmatch '@(localhost|127\.0\.0\.1)[:/]') { Stop-Setup 'the database must be on localhost' }
    if ($env:AUDIT_DB_URL -notmatch '/[^/?]*(loadtest|audit|test)[^/?]*(\?|$)') { Stop-Setup 'the database name must contain loadtest, audit or test' }
}

# Runs a .sql file with psql variables. Output is returned; a non-zero exit throws.
function Invoke-OrdSqlFile([string]$File, [hashtable]$Vars = @{}) {
    if (-not (Test-Path -LiteralPath $File)) { throw "SQL file not found: $File" }
    $psqlArgs = @($env:AUDIT_DB_URL, '-v', 'ON_ERROR_STOP=1', '-q')
    foreach ($k in $Vars.Keys) { $psqlArgs += @('-v', ('{0}={1}' -f $k, $Vars[$k])) }
    $psqlArgs += @('-f', $File)
    $r = Invoke-NativeCapture 'psql' $psqlArgs
    if ($r.ExitCode -ne 0) { throw "psql failed for $File : $($r.Output)" }
    $r.Output
}

function Get-OrdUserId([string]$Email) {
    Invoke-Sql ("SELECT id FROM users WHERE lower(email) = lower({0}) LIMIT 1" -f (Get-SqlLiteral $Email))
}

function Get-OrdMigrationVersion {
    try { Invoke-Sql "SELECT coalesce(max(version)::text, 'none') || CASE WHEN coalesce(bool_or(dirty), false) THEN ' (DIRTY)' ELSE '' END FROM schema_migrations" }
    catch { 'unknown' }
}

function Get-OrdDbZone { try { Invoke-Sql 'SHOW timezone' } catch { 'unknown' } }

function Get-OrdGitInfo {
    $commit = 'unknown'; $branch = 'unknown'; $dirty = 0
    try {
        $commit = [string](& git -C $RepoRoot rev-parse --short HEAD 2>$null)
        $branch = [string](& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null)
        $dirty = @(& git -C $RepoRoot status --porcelain 2>$null).Count
    } catch { }
    [pscustomobject]@{ Commit = $commit; Branch = $branch; Dirty = $dirty }
}

# ---------------------------------------------------------------- HTTP identities

# A guest: a cookie jar that has been given a guest_id and a CSRF cookie by the backend.
function New-OrdGuest([string]$Label) {
    $jar = Join-Path $Tmp "$Label.jar"
    $null = Invoke-Http -Method GET -Url "$BaseUrl/api/csrf-token" -Jar $jar
    [pscustomobject]@{ Jar = $jar; Csrf = (Get-CookieValue $jar $CsrfCookie); GuestId = (Get-CookieValue $jar 'guest_id'); Label = $Label }
}

# Any request with a session (logged in or guest). Adds the CSRF header on writes unless -NoCsrf.
function Invoke-OrdApi($Session, [string]$Method, [string]$Path, [string]$Body = $null, [switch]$NoCsrf, [hashtable]$Headers = @{}) {
    $h = @{}
    foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    $jar = ''
    if ($Session) {
        $jar = $Session.Jar
        if ($Session.Csrf -and (-not $NoCsrf) -and ($Method -ne 'GET')) { $h[$CsrfHeader] = $Session.Csrf }
    }
    Invoke-Http -Method $Method -Url "$BaseUrl$Path" -Jar $jar -Headers $h -Body $Body
}

function Test-OrdBackendReachable($Ctx) {
    $r = Invoke-Http -Method GET -Url "$PublicBase/health"
    $Ctx.Reach = $r
    $label = 'rig backend reachable'
    if (-not $Rig) { $label = 'backend reachable through the ngrok tunnel' }
    Check 'ORD-A1' $label '200 on /health' "$($r.Status)" ($r.Status -eq 200)
    if ($r.Status -ne 200) { Stop-Setup "the backend is not reachable at $PublicBase (HTTP $($r.Status))" }
}

# ---------------------------------------------------------------- invariants (used after every check group)

# Every ORD order: placed by an audit-ord-* customer, or containing an AUDIT-ORD event.
$script:OrdScope = @'
(o.customer_email LIKE 'audit-ord-%' OR EXISTS (SELECT 1 FROM order_items x JOIN events e ON e.id = x.event_id WHERE x.order_id = o.id AND e.event_title LIKE 'AUDIT-ORD%'))
'@

# Returns one line per violation. An empty result means the data is consistent.
function Get-OrdInvariantViolations {
    $scope = $script:OrdScope
    $q = [ordered]@{
        'I2 stock' = @"
SELECT t.name || ': sold=' || t.sold || ' but pending+success orders hold ' || coalesce(r.q, 0)
FROM ticket_tiers t JOIN events e ON e.id = t.event_id
LEFT JOIN (SELECT oi.ticket_tier_id, sum(oi.quantity) AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id
           WHERE o.status IN ('pending', 'processing', 'success') GROUP BY oi.ticket_tier_id) r ON r.ticket_tier_id = t.id
WHERE e.event_title LIKE 'AUDIT-ORD%' AND t.sold <> coalesce(r.q, 0)
"@
        'I3 tickets' = @"
SELECT o.reference || ': status=' || o.status || ' items=' || coalesce(i.q, 0) || ' tickets=' || coalesce(k.n, 0)
FROM orders o
LEFT JOIN (SELECT order_id, sum(quantity) AS q FROM order_items GROUP BY order_id) i ON i.order_id = o.id
LEFT JOIN (SELECT order_id, count(*) AS n FROM tickets GROUP BY order_id) k ON k.order_id = o.id
WHERE $scope AND ((o.status = 'success' AND coalesce(i.q, 0) <> coalesce(k.n, 0))
               OR (o.status NOT IN ('success', 'refunded') AND coalesce(k.n, 0) > 0))
"@
        'I4 email' = @"
SELECT o.reference || ': ticket emails=' || count(m.id)
FROM orders o LEFT JOIN email_outbox m ON m.dedupe_key = 'ticket:' || o.reference
WHERE o.status = 'success' AND $scope
GROUP BY o.reference HAVING count(m.id) <> 1
"@
        'I5 money' = @"
SELECT o.reference || ': status=' || o.status || ' amount_paid=' || o.amount_paid
FROM orders o
WHERE $scope AND o.amount_paid > 0 AND o.status NOT IN ('success', 'refunded')
"@
        'I6 totals' = @"
SELECT o.reference || ': final_total ' || o.final_total || ' <> ' || (o.subtotal + o.service_fee + o.vat_amount)
FROM orders o WHERE $scope AND o.final_total <> o.subtotal + o.service_fee + o.vat_amount
UNION ALL
SELECT o.reference || ': subtotal ' || o.subtotal || ' <> items ' || s.t
FROM orders o JOIN (SELECT order_id, sum(subtotal) AS t FROM order_items GROUP BY order_id) s ON s.order_id = o.id
WHERE $scope AND o.subtotal <> s.t
UNION ALL
SELECT oi.id::text || ': unit_price * quantity <> subtotal'
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE $scope AND oi.unit_price::bigint * oi.quantity <> oi.subtotal
"@
    }
    $found = New-Object System.Collections.Generic.List[string]
    foreach ($key in $q.Keys) {
        $rows = Invoke-Sql $q[$key]
        foreach ($line in ($rows -split "`n")) {
            if ($line.Trim()) { $found.Add("$key  $($line.Trim())") }
        }
    }
    $found.ToArray()
}

function Test-OrdInvariants([string]$Id, [string]$Name) {
    $v = @(Get-OrdInvariantViolations)
    $actual = 'none'
    $note = ''
    if ($v.Count -gt 0) {
        $actual = "$($v.Count) violation(s)"
        $note = (($v | Select-Object -First 3) -join ' ; ')
    }
    Check $Id $Name 'no violations' $actual ($v.Count -eq 0) $note
}
