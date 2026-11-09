# audit/suites/ord/checks-schema.ps1
# ORD-S: schema parity and data integrity for the order path. A FAIL that carries "known finding F2xx"
# is a gap in the product, recorded honestly; it is not a harness error. A thrown exception is a step failure.

function Check-OrdFinding([string]$Id, [string]$Name, [string]$Expected, [string]$Actual, [bool]$Ok, [string]$Finding) {
    $note = ''
    if (-not $Ok) { $note = "known finding $Finding" }
    Check $Id $Name $Expected $Actual $Ok $note
}

function Test-OrdSchema($Ctx) {
    # S1 tables
    $need = "'orders','order_items','tickets','ticket_tiers','events','payments','email_outbox','webhook_inbox'"
    $n = [int](Invoke-Sql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ($need)")
    Check 'ORD-S1' 'the tables the order path needs exist' '8 tables' "$n tables" ($n -eq 8)

    # S2 order_status labels the Go code writes
    $labels = (Invoke-Sql "SELECT coalesce(string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder), '') FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'order_status'") -split ','
    $want = 'pending', 'processing', 'success', 'failed', 'refunded', 'fraud', 'expired'
    $missing = @($want | Where-Object { $labels -notcontains $_ })
    Check 'ORD-S2' 'order_status has every label the code writes' ($want -join ',') ($labels -join ',') ($missing.Count -eq 0) $(if ($missing.Count) { 'missing: ' + ($missing -join ',') } else { '' })

    # S3 ticket_status
    $tl = (Invoke-Sql "SELECT coalesce(string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder), '') FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'ticket_status'") -split ','
    Check 'ORD-S3' 'ticket_status has active and used' 'active, used' ($tl -join ',') (($tl -contains 'active') -and ($tl -contains 'used'))
    if (($tl -contains 'canceled') -and ($tl -contains 'cancelled')) {
        Add-Result 'ORD-S3b' 'ticket_status has two spellings of cancel' 'one spelling' ($tl -join ',') 'INFO' 'F213: no Go code writes either today. Refund and void logic will use cancelled (matches subscriptions); a later check asserts nothing writes canceled.'
    }

    # S4 outbox dedupe index (ticket:<reference> relies on it)
    $n = [int](Invoke-Sql "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'email_outbox' AND indexdef LIKE 'CREATE UNIQUE%' AND indexdef LIKE '%(dedupe_key)%'")
    Check 'ORD-S4' 'email_outbox dedupe_key has a unique index' '>= 1' "$n" ($n -ge 1)

    # S5 reference uniqueness
    $n = [int](Invoke-Sql "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orders' AND indexdef LIKE 'CREATE UNIQUE%' AND indexdef LIKE '%(reference)%'")
    Check 'ORD-S5' 'orders.reference is unique' '>= 1 unique index' "$n" ($n -ge 1)

    # S6 stock CHECKs
    $n = [int](Invoke-Sql "SELECT count(*) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conname IN ('check_stock_consistency','check_available_non_negative','check_sold_within_capacity')")
    Check 'ORD-S6' 'ticket_tiers stock CHECK constraints present' '3' "$n" ($n -eq 3)

    # S7 CHECKs on the order tables (F211)
    $n = [int](Invoke-Sql "SELECT count(*) FROM pg_constraint WHERE contype = 'c' AND connamespace = 'public'::regnamespace AND conrelid::regclass::text IN ('orders','order_items','payments','tickets')")
    Check-OrdFinding 'ORD-S7' 'order tables guard totals, amounts and quantities with CHECK constraints' '>= 1' "$n" ($n -ge 1) 'F211'

    # S8 money columns are bigint (F218)
    $sql = @'
SELECT count(*) FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.data_type <> 'bigint'
  AND (c.table_name, c.column_name) IN (('orders','subtotal'),('orders','service_fee'),('orders','vat_amount'),('orders','final_total'),
       ('orders','amount_paid'),('order_items','unit_price'),('order_items','subtotal'),('payments','amount_paid'),('payments','fees_paid'))
'@
    $n = [int](Invoke-Sql $sql)
    Check-OrdFinding 'ORD-S8' 'money columns are bigint' '0 columns narrower than bigint' "$n" ($n -eq 0) 'F218'

    # S9 event dates keep their time zone (F214)
    $n = [int](Invoke-Sql "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND data_type = 'timestamp without time zone'")
    Check-OrdFinding 'ORD-S9' 'order_items timestamps carry a time zone' '0 columns without one' "$n" ($n -eq 0) 'F214'

    # S10 duplicate indexes on the hot tables (F212)
    $sql = @'
SELECT count(*) FROM (
  SELECT tablename FROM pg_indexes
  WHERE schemaname = 'public' AND tablename IN ('orders','order_items','payments','tickets','ticket_tiers')
  GROUP BY tablename, regexp_replace(indexdef, 'INDEX \S+ ON ', 'INDEX ON ')
  HAVING count(*) > 1) d
'@
    $n = [int](Invoke-Sql $sql)
    Check-OrdFinding 'ORD-S10' 'no identical duplicate indexes on the order tables' '0 duplicate groups' "$n" ($n -eq 0) 'F212'

    # S11 an illegal status change is blocked in the database (F211)
    $n = [int](Invoke-Sql "SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table = 'orders' AND trigger_name <> 'orders_updated_at'")
    Check-OrdFinding 'ORD-S11' 'orders has a status-transition guard' '>= 1 trigger besides updated_at' "$n" ($n -ge 1) 'F211'

    # S12 reaper index (measured with EXPLAIN in P1)
    $n = [int](Invoke-Sql "SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orders' AND indexdef LIKE '%WHERE%' AND indexdef LIKE '%pending%'")
    if ($n -eq 0) { Add-Result 'ORD-S12' 'a partial index for pending orders (the reaper query)' '>= 1' "$n" 'INFO' 'F219: the reaper scans (status, created_at). P1 measures it with EXPLAIN under load.' }
    else { Add-Result 'ORD-S12' 'a partial index for pending orders (the reaper query)' '>= 1' "$n" 'PASS' }

    # S13 fixtures
    $ev = [int](Invoke-Sql "SELECT count(*) FROM events WHERE event_title LIKE 'AUDIT-ORD%'")
    $ti = [int](Invoke-Sql "SELECT count(*) FROM ticket_tiers t JOIN events e ON e.id = t.event_id WHERE e.event_title LIKE 'AUDIT-ORD%'")
    Check 'ORD-S13' 'ORD fixtures are present' '4 events, 10 tiers' "$ev events, $ti tiers" (($ev -eq 4) -and ($ti -eq 10))

    # S14 data integrity of everything ORD owns
    Test-OrdInvariants 'ORD-S14' 'stock, tickets, emails and totals agree for every ORD order'
}
