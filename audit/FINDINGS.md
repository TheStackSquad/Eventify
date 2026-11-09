| ID | Sev | Area | Finding | Evidence | Status | Fix commit |
|---|---|---|---|---|---|---|
| F-001 | Critical | Secrets | Private keys and .env committed to public repo | gitleaks | Open | |

# ORD findings (F200-F299)

Status: **predicted** = read from the code, not yet proven; **confirmed** / **cleared** = a check proved it (id in the last column).
P1a covers the initialize and pricing findings. P1b covers webhook, verify, reaper, tickets and concurrency.

| ID | Finding | Status | Check |
|---|---|---|---|
| F200 | A payment on an expired, failed or fraud order gets a silent 200: customer charged, no tickets, no flag | predicted | P1b |
| F201 | Verify authorizes with the order's own UserID, so anyone can verify and read a logged-in user's order | predicted | P1b |
| F202 | The "unauthorized" error is not mapped; a wrong guest gets 402 VERIFY_FAILED | predicted | P1b |
| F203 | Verify may treat Paystack `failed` as final and release stock while the buyer can still retry | hypothesis | P1b + manual |
| F204 | Amount mismatch sets fraud and releases stock; no review state; the update is not guarded by status | predicted | P1b |
| F205 | An order with no items panics in finalizeOrder (`order.Items[0]`) | predicted | P1b |
| F206 | Ticket codes use 8 random hex characters of the reference; a collision fails finalize as a retryable error. Dev secret fallback | predicted | P1b |
| F207 | No idempotency on initialize; a double submit reserves stock twice; cookie-less calls mint new guests | predicted | ORD-I7.1, I3.1 |
| F208 | No payment ledger for orders (`payments` table exists, nothing writes to it) | confirmed (grep) | - |
| F209 | Fee tier inversion: 500001 kobo totals less than 500000 | predicted | ORD-P8.1 |
| F210 | app_profit counts VAT as profit; Paystack fee estimate ignores caps and waivers | predicted | ORD-P*.3 |
| F211 | No CHECK constraints and no status-transition guard on the order tables | confirmed | ORD-S7, S11 |
| F212 | Identical duplicate indexes on the order tables | confirmed | ORD-S10 |
| F213 | ticket_status has both `canceled` and `cancelled` (no code writes either) | confirmed | ORD-S3b |
| F214 | order_items event dates are `timestamp without time zone` | confirmed | ORD-S9 |
| F215 | A free ticket (total 0) fails at the gateway as a 503 | predicted | ORD-I11.1 |
| F216 | An ended or deleted event can still be bought | predicted | ORD-I10.1, I10.2 |
| F217 | Reaper interval (1 min) and expiry (15 min) are hardcoded in main.go | confirmed (code) | - |
| F218 | Order money columns are `integer` (about 21.4M naira ceiling) while the Go model uses int64 | confirmed | ORD-S8 |
| F219 | No partial index serves the reaper query | confirmed | ORD-S12 |
| F220 | Names and phone numbers longer than their columns return 500 instead of 400 | predicted | ORD-I4.14, I4.15 |