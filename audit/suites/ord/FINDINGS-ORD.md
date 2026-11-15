# ORD findings (F200-F299)

Status: **predicted** = read from the code, not yet proven; **confirmed** / **cleared** = a check proved it (id in the last column).
Evidence: P0 baseline ord-matrix-20261108-054157, P1a ord-matrix-20261108-082618, P2a1 ord-matrix-20261115-102437 (FAIL=3 INFO=7 PASS=72). P1b covers webhook, verify, reaper, tickets, concurrency and DB statement budgets.

| ID | Finding | Status | Check |
|---|---|---|---|
| F200 | A payment on an expired, failed or fraud order gets a silent 200: customer charged, no tickets, no flag | predicted | P1b |
| F201 | Verify authorizes with the order's own UserID, so anyone can verify and read a logged-in user's order | predicted | P1b |
| F202 | The "unauthorized" error is not mapped; a wrong guest gets 402 VERIFY_FAILED | predicted | P1b |
| F203 | Verify may treat Paystack `failed` as final and release stock while the buyer can still retry | hypothesis | P1b + manual |
| F204 | Amount mismatch sets fraud and releases stock; no review state; the update is not guarded by status | predicted | P1b |
| F205 | An order with no items panics in finalizeOrder (`order.Items[0]`) | predicted | P1b |
| F206 | Ticket codes use 8 random hex characters of the reference; a collision fails finalize as a retryable error. Dev secret fallback | predicted | P1b |
| F207 | No idempotency on initialize; a double submit reserves stock twice; cookie-less calls mint new guests | **confirmed**, open (next patch: migration 000016) | ORD-I7.1, I3.1 |
| F208 | No payment ledger for orders (`payments` table exists, nothing writes to it) | confirmed (grep) | - |
| F209 | Fee tier inversion: 500001 kobo totals 543001, less than 500000 (550000) | **confirmed** | ORD-P8.1 |
| F210 | app_profit counts VAT as profit; Paystack fee estimate ignores caps and waivers | **fixed** in P2a1 for VAT (evidence ord-matrix-20261115-102437); the Paystack fee cap and waiver is still open (needs real Paystack data, tunnel run) | ORD-P2.3, P3.3, P5.3, P7.3 |
| F211 | No CHECK constraints and no status-transition guard | **fixed** (migration 000013 CHECKs; migration 000014 guard, 25 transitions verified) | ORD-S7, S11, S11b |
| F212 | Identical duplicate indexes on the order tables | **cleared** by migration 000012 (verified) | ORD-S10 |
| F213 | ticket_status has both `canceled` and `cancelled` (no code writes either) | confirmed (INFO) | ORD-S3b |
| F214 | order_items event dates are `timestamp without time zone` | **cleared** by migration 000013 (verified) | ORD-S9 |
| F215 | A free ticket (total 0) fails at the gateway as a 503 | **confirmed**, fix in P2a2 (refused with 400 FREE_TICKETS_UNSUPPORTED) | ORD-I11.1 |
| F216 | An ended or deleted event can still be bought | **cleared** (404 TICKET_UNAVAILABLE) | ORD-I10.1, I10.2 |
| F217 | Reaper interval (1 min) and expiry (15 min) are hardcoded in main.go | confirmed (code) | - |
| F218 | Order money columns are `integer` (about 21.4M naira ceiling) while the Go model uses int64 | **cleared** by migration 000011 (verified) | ORD-S8 |
| F219 | No partial index serves the reaper query | confirmed (INFO) | ORD-S12 |
| F220 | Names and phone numbers longer than their columns return 500 instead of 400 | **fixed** in P2a1 (400 INVALID_ORDER) | ORD-I4.14, I4.15 |
| F221 | The reaper releases at most 100 expired orders per pass (`LIMIT 100`, one pass a minute, one transaction per order): after a rush, abandoned orders keep stock locked for a long time and a show looks sold out while tickets are free | predicted | P1b (ORD-R) |
| F222 | Too many database round trips per order (about 28 statements for a 3-ticket order: N+1 pricing, per-item and per-ticket inserts, duplicate order reads in verify) | predicted | P1b (ORD-Q, pg_stat_statements) |
| F223 | WriteLimiter is 1 write per 5 s with burst 3 per client, one shared bucket for every write route, per process: buyers behind one NAT block each other, several instances multiply the allowance | predicted | P1b (ORD-L) |
| F224 | Frontend aborts and retries initialize with no idempotency key (the server still creates the first order), and its 30 s timeout exceeds the server's 20 s write timeout | predicted | P2 (frontend) |
