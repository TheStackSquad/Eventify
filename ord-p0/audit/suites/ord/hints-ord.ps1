# audit/suites/ord/hints-ord.ps1
# "Where to look" text for the report. One entry per check id; Get-OrdHint falls back to a default.
$script:OrdHints = @{
    'ORD-A1' = 'The backend is not answering. Rig: docker compose -f audit/docker/docker-compose.loadtest.yml logs backend. Tunnel: confirm ngrok forwards to the backend port.'
    'ORD-A2' = 'Login failed for AUDIT_VENDOR_EMAIL (the ORD organizer). Check the account exists in the rig database and the password in audit\docker\.env.'
    'ORD-S1' = 'A table the order path needs is missing. The rig builds from audit\docker\schema.sql; recreate the rig volume or regenerate the baseline.'
    'ORD-S2' = 'The order_status enum lacks a label the Go code writes (models/order.go). Add it in a migration.'
    'ORD-S4' = 'ticket:<reference> dedupe needs the partial unique index from migration 000005.'
    'ORD-S6' = 'Stock CHECK constraints on ticket_tiers are the last line of defence against oversell.'
    'ORD-S7' = 'F211: orders, order_items, payments and tickets have no CHECK constraints (totals, non-negative amounts, quantities).'
    'ORD-S8' = 'F218: money columns are integer (about 21.4M naira ceiling) while the Go model uses int64. Widen in a migration.'
    'ORD-S9' = 'F214: order_items.event_start_date / event_end_date are timestamp without time zone (same class as F19).'
    'ORD-S10' = 'F212: identical duplicate indexes add write cost to every checkout. Drop one of each pair in a migration.'
    'ORD-S11' = 'F211: nothing in the database stops an illegal order status change (for example success back to fraud).'
    'ORD-S13' = 'Fixtures are incomplete. Re-run with -Reset, then check audit\sql\ord_seed.sql output.'
    'ORD-S14' = 'An invariant is broken: stock, tickets, emails or totals disagree. The listed lines name the order or tier.'
}
function Get-OrdHint([string]$Id) {
    if ($script:OrdHints.ContainsKey($Id)) { return $script:OrdHints[$Id] }
    'See the suite findings file for this check.'
}
