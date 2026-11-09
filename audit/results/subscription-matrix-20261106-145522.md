# Subscription matrix evidence

| Item | Value |
|---|---|
| Run (UTC) | 2026-11-06 14:55:22 |
| Git commit | 1fb1469 (4 uncommitted paths in the repo) |
| Mode | tunnel mode, automated + manual payment tests |
| Backend | built from the working tree by this script |
| Tunnel host | https://autopilot-secrecy-scraggly.ngrok-free.dev |
| Paystack | test mode (real Paystack); key prefix verified, key not recorded |

## Results

| ID | Check | Expected | Got | Result |
|---|---|---|---|---|
| S1 | backend reachable through the ngrok tunnel | 200 | 200 | **PASS** |
| S2 | vendor 1 session works | 200 on /me | 200 | **PASS** |
| S3 | CSRF cookie after login | present | present | **INFO** |
| T13.1 | public plans match the server price table | basic=350000, premium=1000000, featured=2500000 | basic=350000, premium=1000000, featured=2500000 | **PASS** |
| T12.1 | initiate without a session is rejected | 401 | 401 | **PASS** |
| T12.2 | verify without a session is rejected | 401 | 401 | **PASS** |
| T12.3 | initiate with a session but no CSRF token is rejected | 403 and no ledger row | 403, +0 rows | **PASS** |
| T10.1 | free, unknown and malformed tiers rejected, nothing written | 400 and +0 rows for each | 'free'->400/+0 'platinum'->400/+0 ''->400/+0 'PREMIUM'->400/+0 | **PASS** |
| T10.2 | the vendor comes from the session, not the request body | 201 and ledger vendor = session vendor | 201, eee4b3d4-3c6b-4d44-879b-9e1e27d52b6f | **PASS** |
| T9.1 | initiate returns a reference and a checkout URL | 201 and https://checkout.paystack.com/... | 201 | **PASS** |
| T9.2 | ledger row written before payment | initiated, server price, session vendor, no webhook yet | initiated 1000000 attempts=0 | **PASS** |
| T9.3 | no pending subscription row is created | subscription rows unchanged | 0 -> 0 | **PASS** |
| T3.1 | wrong signature rejected | 401 | 401 | **PASS** |
| T3.2 | missing signature rejected | 401 | 401 | **PASS** |
| T3.3 | valid HMAC of a different body rejected and not counted | 401 and attempts = 0 | 401, attempts=0 | **PASS** |
| T9.4 | verify on an unpaid reference is refused | 422 PAYMENT_NOT_SUCCESSFUL | 422 PAYMENT_NOT_SUCCESSFUL | **PASS** |
| T9.5 | verify changed nothing | ledger still initiated, subscription state identical | initiated; same=True | **PASS** |
| T9b.1 | signed webhook claiming success for an unpaid transaction is acknowledged | 200 | 200 | **PASS** |
| T9b.2 | it changes nothing and is counted | ledger initiated, state identical, attempts >= 1 | initiated; same=True; attempts=1 | **PASS** |
| T8.1 | another vendor cannot verify this payment | 404 PAYMENT_NOT_FOUND | 404 PAYMENT_NOT_FOUND | **PASS** |
| T3c.1 | signed webhook for an unknown reference is acknowledged, no side effects | 200 and no new rows | 200, +0 ledger, +0 subscriptions | **PASS** |
| T3d.1 | a real-shaped webhook for an unknown reference is kept as an orphan | 200 and status orphan | 200, orphan/1 | **PASS** |
| T3f.1 | the same webhook delivered again is counted, not duplicated | 200, one row, 2 attempts | 200, 1 row(s), orphan/2 | **PASS** |
| T3e.1 | a signed body we cannot read is kept and Paystack is told to retry | 500 and status failed | 500, failed/1 | **PASS** |
| T3g.1 | a wrongly signed webhook is rejected and never stored | 401 and +0 inbox rows | 401, +0 | **PASS** |
| T3h.1 | a payment with no type in its metadata is checked against both ledgers, then kept as an orphan | 200 and status orphan | 200, orphan/1 | **PASS** |
| T16.1 | 2 MB webhook body | 400 or 413 (size cap) | 400 | **PASS** |
| T17.1 | hostile references produce 4xx, never 5xx | 4xx for each | 400 400 404 404 | **PASS** |
| L1.1 | a plan 6 days from expiry gets one 7-day reminder | 1/0/0/0/0 | 1/0/0/0/0 | **PASS** |
| L1.2 | after an outage only the nearest missed reminder (3-day) goes out | 0/1/0/0/0 | 0/1/0/0/0 | **PASS** |
| L1.3 | a plan 12 hours from expiry gets the 1-day reminder; a long-expired row and old payments stay silent | 0/0/1/0/0 | 0/0/1/0/0 | **PASS** |
| L2.1 | a lapsed plan is switched off, the vendor returns to free, one notice is queued | expired, free, 0/0/0/1/0 | expired, free, 0/0/0/1/0 | **PASS** |
| L4.1 | further worker passes queue nothing new | emails queued, then counts unchanged | unchanged | **PASS** |
| T1.1 | paying through Paystack applies the payment | ledger applied | applied | **PASS** |
| T1.2 | Paystack delivered the webhook through the tunnel | webhook_attempts >= 1 | 1 | **PASS** |
| T1.3 | one active subscription of the paid tier, vendor tier synced | active=1, tier=premium | active=1, tier=premium | **PASS** |
| T1.4 | expiry moved forward by about one month | 27 to 32 days | 30 days | **PASS** |
| T2.1 | re-delivered signed webhooks are acknowledged | 200 and 200 | 200 and 200 | **PASS** |
| T2.2 | re-delivery does not extend or duplicate the subscription | state identical | same=True | **PASS** |
| T5.1 | an amount mismatch is parked for review | needs_review | needs_review | **PASS** |
| T5.2 | the subscription is untouched | state identical | same=True | **PASS** |
| T5.3 | the vendor is told the payment is under review | 409 PAYMENT_UNDER_REVIEW | 409 PAYMENT_UNDER_REVIEW | **PASS** |
| L3.1 | each paid month (first purchase or renewal) queues exactly one receipt | 1 receipt(s) | 1 receipt(s) | **PASS** |
| T7.1 | a different tier is refused while a plan is active | 409 ACTIVE_PLAN_EXISTS and +0 rows | 409 ACTIVE_PLAN_EXISTS +0 | **PASS** |

## Next steps (where to look)

- **S3 [INFO]** CSRF cookie after login: No CSRF cookie after login. Confirm -CsrfCookie and -CsrfHeader against the CSRF middleware (csrfConfig).

## Claims supported by this run

- An initiated but unpaid payment cannot activate or extend a subscription through the verify endpoint.
- A correctly signed webhook that claims success for an unpaid transaction is acknowledged but changes nothing: the server re-verifies with the gateway and does not trust the payload.
- Webhooks with a wrong, missing or mismatched signature are rejected with 401 and cause no state change.
- A signed webhook for an unknown reference is acknowledged and has no side effects.
- Every signature-verified webhook is stored before it is processed, and a repeat delivery is counted, not duplicated.
- A signed webhook the server cannot read is kept and Paystack is told to retry, never silently acknowledged.
- A webhook that fails signature verification is rejected and never stored.
- A payment whose metadata is missing is checked against both ledgers, and kept as an orphan only if neither knows it.
- The public plans endpoint matches the server price table (one source of truth).
- Free, unknown and malformed tiers are rejected before any payment record is written.
- The paying vendor always comes from the session, never from the request body.
- A vendor cannot verify another vendor's payment.
- Hostile reference strings produce 4xx responses, never 5xx.
- Initiate and verify require an authenticated session, and initiate also requires a CSRF token.
- A real Paystack test payment activates the subscription once, and Paystack's webhook reaches the backend through the tunnel.
- Re-delivered signed webhooks do not extend or duplicate the subscription.
- A vendor with an active plan cannot start a payment for a different tier.
- An amount mismatch parks the payment for manual review and leaves the subscription untouched.
- Reminders reach every vendor with a plan nearing expiry, once per window, and a worker outage never causes a burst.
- A lapsed plan is switched off, the vendor returns to the free tier and is told once; old expiries stay silent.
- Every paid month, whether a first purchase or a renewal, produces exactly one receipt email.
- Repeated worker passes never send the same email twice.

## Not demonstrated in this run

None.

## Limits of this evidence

- One backend process on one machine. Multi-instance behaviour is not exercised.
- Paystack test mode and one payment channel. Live mode and other channels may behave differently.
- Concurrency is proven at repository level by the Go integration tests, not through HTTP here.
- The webhook URL saved in the Paystack dashboard cannot be read by this script; T1.2 confirms it indirectly.
- Expiry, time zone and reminder behaviour (milestone M6) and browser behaviour (M8) are not covered.
- Lost-webhook reconciliation (T4) and transient database failure (T6) remain manual procedures.
