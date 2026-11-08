# audit/suites/ord/hints-ord.ps1
# "Where to look" text for the report. Exact check id first, then the family prefix, then a default.
$script:OrdHints = @{
    'ORD-A1'   = 'The backend is not answering. Rig: docker compose -f audit/docker/docker-compose.loadtest.yml logs backend. Tunnel: confirm ngrok forwards to the backend port.'
    'ORD-A2'   = 'Login failed for AUDIT_VENDOR_EMAIL (the ORD organizer). Check the account exists in the rig database and the password in audit\docker\.env.'
    'ORD-S1'   = 'A table the order path needs is missing. The rig builds from audit\docker\schema.sql; recreate the rig volume or regenerate the baseline.'
    'ORD-S2'   = 'The order_status enum lacks a label the Go code writes (models/order.go). Add it in a migration.'
    'ORD-S4'   = 'ticket:<reference> dedupe needs the partial unique index from migration 000005.'
    'ORD-S6'   = 'Stock CHECK constraints on ticket_tiers are the last line of defence against oversell.'
    'ORD-S7'   = 'F211: orders, order_items, payments and tickets have no CHECK constraints (totals, non-negative amounts, quantities).'
    'ORD-S8'   = 'F218: money columns are integer (about 21.4M naira ceiling) while the Go model uses int64. Widen in a migration.'
    'ORD-S9'   = 'F214: order_items.event_start_date / event_end_date are timestamp without time zone (same class as F19).'
    'ORD-S10'  = 'F212: identical duplicate indexes add write cost to every checkout. Drop one of each pair in a migration.'
    'ORD-S11'  = 'F211: nothing in the database stops an illegal order status change (for example success back to fraud).'
    'ORD-S13'  = 'Fixtures are incomplete. Re-run with -Reset, then check audit\sql\ord_seed.sql output.'
    'ORD-I4.14' = 'F220: names and phone numbers are not length-checked before the insert, so the database error surfaces as a 500. Validate lengths in models/order_initialization.go.'
    'ORD-I4.15' = 'F220: see ORD-I4.14.'
    'ORD-I7.1' = 'F207: InitializePendingOrder has no idempotency key; every call reserves stock. Add a key (header or body) stored on orders with a unique index per identity.'
    'ORD-I10.1' = 'F216: pricing_service.go does not check the event date or is_deleted. Add the check to GetTierDetailsByID or the pricing service.'
    'ORD-I10.2' = 'F216: see ORD-I10.1.'
    'ORD-I11.1' = 'F215: a zero total is sent to Paystack, which rejects it, so the buyer sees a gateway error. Decide the free-ticket flow (issue directly, or refuse).'
    'ORD-P8.1' = 'F209: CalculateServiceFee switches from 10% to 7% + 50 naira at the threshold, so the total drops. Use a banded (marginal) fee.'
    'ORD-P2.3' = 'F210: AppProfit adds VAT to profit in pricing_service.go and order_processing.go. Profit should exclude VAT.'
    'ORD-P3.3' = 'F210: AppProfit adds VAT to profit in pricing_service.go and order_processing.go. Profit should exclude VAT.'
    'ORD-P5.3' = 'F210: AppProfit adds VAT to profit in pricing_service.go and order_processing.go. Profit should exclude VAT.'
    'ORD-P7.3' = 'F210: AppProfit adds VAT to profit in pricing_service.go and order_processing.go. Profit should exclude VAT.'
}
$script:OrdFamilyHints = @{
    'ORD-I' = 'Initialize problem: see handlers/order/order.go InitializeOrder and services/order/order_services.go InitializePendingOrder.'
    'ORD-P' = 'Pricing problem: see models/order.go (fee constants) and services/pricing/pricing_service.go.'
    'ORD-S' = 'Schema problem: compare audit\docker\schema.sql with backend\migrations.'
}
function Get-OrdHint([string]$Id) {
    if ($script:OrdHints.ContainsKey($Id)) { return $script:OrdHints[$Id] }
    # ORD-P4.3 and friends: a pricing finding check shares the hint of its finding id, so fall back to the family
    foreach ($k in $script:OrdFamilyHints.Keys) { if ($Id.StartsWith($k)) { return $script:OrdFamilyHints[$k] } }
    'See the suite findings file for this check.'
}
