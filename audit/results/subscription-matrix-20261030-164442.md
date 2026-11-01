# Subscription matrix evidence

| Item | Value |
|---|---|
| Run (UTC) | 2026-10-30 16:44:42 |
| Git commit | 7728f36 (50 uncommitted paths in the repo) |
| Mode | tunnel mode, automated only |
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
| T10.2 | the vendor comes from the session, not the request body | 201 and ledger vendor = session vendor | 502, no row | **FAIL** |
| T9.1 | initiate returns a reference and a checkout URL | 201 and https://checkout.paystack.com/... | 502 | **FAIL** |
| T9.2 | needs a real reference from T9.1 |  |  | **SKIP** |
| T9.3 | needs a real reference from T9.1 |  |  | **SKIP** |
| T9.4 | needs a real reference from T9.1 |  |  | **SKIP** |
| T9.5 | needs a real reference from T9.1 |  |  | **SKIP** |
| T9b.1 | needs a real reference from T9.1 |  |  | **SKIP** |
| T9b.2 | needs a real reference from T9.1 |  |  | **SKIP** |
| T3.1 | needs a real reference from T9.1 |  |  | **SKIP** |
| T3.2 | needs a real reference from T9.1 |  |  | **SKIP** |
| T3.3 | needs a real reference from T9.1 |  |  | **SKIP** |
| T8.1 | needs a real reference from T9.1 |  |  | **SKIP** |
| T3c.1 | signed webhook for an unknown reference is acknowledged, no side effects | 200 and no new rows | 200, +0 ledger, +0 subscriptions | **PASS** |
| T16.1 | 2 MB webhook body | 400 or 413 (size cap) | 400 | **PASS** |
| T17.1 | hostile references produce 4xx, never 5xx | 4xx for each | 400 400 404 404 | **PASS** |
| T7.1 | a different tier is refused while a plan is active | 409 |  | **SKIP** |

## Next steps (where to look)

- **T10.2 [FAIL]** the vendor comes from the session, not the request body: The request body influenced which vendor was charged. The vendor must come only from ExtractVendorID.
- **T9.1 [FAIL]** initiate returns a reference and a checkout URL: Initiate failed. Check S3 (CSRF), the backend log, and that the backend can reach its Paystack base URL.
- **T9.2 [SKIP]** needs a real reference from T9.1: Ledger row missing or wrong. Check CreatePayment, that backend and AUDIT_DB_URL use the same database, and that migration 000001 is applied there.
- **T9.3 [SKIP]** needs a real reference from T9.1: A subscription row was created at initiate. An old pending-row code path is still active.
- **T9.4 [SKIP]** needs a real reference from T9.1: Verify did not refuse an unpaid reference. A 200 means the activation hole is back: settle() must require data.status == success. A 500 usually means the gateway answered 'not found': map ErrTransactionNotFound to ErrPaymentNotSuccessful.
- **T9.5 [SKIP]** needs a real reference from T9.1: Verify changed state for an unpaid reference. Stop and inspect settle() and SettlePayment.
- **T9b.1 [SKIP]** needs a real reference from T9.1: A permanent failure was not acknowledged with 200. Check IsRetryable and the dispatcher's error branch.
- **T9b.2 [SKIP]** needs a real reference from T9.1: A webhook that merely claims success changed state or was not counted. The server must re-verify with the gateway and count attempts on the ledger.
- **T3.1 [SKIP]** needs a real reference from T9.1: A forged signature was not rejected with 401. Check VerifyWebhookSignature in HandlePaystackWebhook.
- **T3.2 [SKIP]** needs a real reference from T9.1: A missing signature was not rejected with 401. Check the dispatcher's signature handling.
- **T3.3 [SKIP]** needs a real reference from T9.1: A signature over a different body was accepted or counted. The HMAC must cover the exact raw body, and counting must come after verification.
- **T8.1 [SKIP]** needs a real reference from T9.1: Another vendor could reach this payment. Check the ownership comparison in VerifyAndFinalize (and that unknown references look identical).
- **T7.1 [SKIP]** a different tier is refused while a plan is active: Tier switching while active is not blocked. Check the R2 rule in InitiateSubscription.
- **S3 [INFO]** CSRF cookie after login: No CSRF cookie after login. Confirm -CsrfCookie and -CsrfHeader against the CSRF middleware (csrfConfig).

## Claims supported by this run

- A signed webhook for an unknown reference is acknowledged and has no side effects.
- The public plans endpoint matches the server price table (one source of truth).
- Free, unknown and malformed tiers are rejected before any payment record is written.
- Hostile reference strings produce 4xx responses, never 5xx.
- Initiate and verify require an authenticated session, and initiate also requires a CSRF token.

## Not demonstrated in this run

- An initiated but unpaid payment cannot activate or extend a subscription through the verify endpoint. (needs: T9.4, T9.5)
- A correctly signed webhook that claims success for an unpaid transaction is acknowledged but changes nothing: the server re-verifies with the gateway and does not trust the payload. (needs: T9b.1, T9b.2)
- Webhooks with a wrong, missing or mismatched signature are rejected with 401 and cause no state change. (needs: T3.1, T3.2, T3.3)
- The paying vendor always comes from the session, never from the request body. (needs: T10.2)
- A vendor cannot verify another vendor's payment. (needs: T8.1)
- A real Paystack test payment activates the subscription once, and Paystack's webhook reaches the backend through the tunnel. (needs: T1.1, T1.2, T1.3, T1.4)
- Re-delivered signed webhooks do not extend or duplicate the subscription. (needs: T2.1, T2.2)
- A vendor with an active plan cannot start a payment for a different tier. (needs: T7.1)
- An amount mismatch parks the payment for manual review and leaves the subscription untouched. (needs: T5.1, T5.2, T5.3)

## Limits of this evidence

- One backend process on one machine. Multi-instance behaviour is not exercised.
- Paystack test mode and one payment channel. Live mode and other channels may behave differently.
- Concurrency is proven at repository level by the Go integration tests, not through HTTP here.
- The webhook URL saved in the Paystack dashboard cannot be read by this script; T1.2 confirms it indirectly.
- Expiry, time zone and reminder behaviour (milestone M6) and browser behaviour (M8) are not covered.
- Lost-webhook reconciliation (T4) and transient database failure (T6) remain manual procedures.
