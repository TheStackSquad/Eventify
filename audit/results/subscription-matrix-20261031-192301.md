# Subscription matrix evidence

| Item | Value |
|---|---|
| Run (UTC) | 2026-10-31 19:23:01 |
| Git commit | 7728f36 (77 uncommitted paths in the repo) |
| Mode | tunnel mode, automated + manual payment tests |
| Backend | built from the working tree by this script |
| Tunnel host | https://autopilot-secrecy-scraggly.ngrok-free.dev |
| Paystack | test mode (real Paystack); key prefix verified, key not recorded |

## Results

| ID | Check | Expected | Got | Result |
|---|---|---|---|---|
| S1 | backend reachable through the ngrok tunnel | 200 | 400 | **FAIL** |

## Next steps (where to look)

- **S1 [FAIL]** backend reachable through the ngrok tunnel: The backend is not reachable. Rig: docker compose logs backend. Tunnel mode: confirm ngrok forwards to the right port.

## Claims supported by this run

None.

## Not demonstrated in this run

- An initiated but unpaid payment cannot activate or extend a subscription through the verify endpoint. (needs: T9.4, T9.5)
- A correctly signed webhook that claims success for an unpaid transaction is acknowledged but changes nothing: the server re-verifies with the gateway and does not trust the payload. (needs: T9b.1, T9b.2)
- Webhooks with a wrong, missing or mismatched signature are rejected with 401 and cause no state change. (needs: T3.1, T3.2, T3.3)
- A signed webhook for an unknown reference is acknowledged and has no side effects. (needs: T3c.1)
- The public plans endpoint matches the server price table (one source of truth). (needs: T13.1)
- Free, unknown and malformed tiers are rejected before any payment record is written. (needs: T10.1)
- The paying vendor always comes from the session, never from the request body. (needs: T10.2)
- A vendor cannot verify another vendor's payment. (needs: T8.1)
- Hostile reference strings produce 4xx responses, never 5xx. (needs: T17.1)
- Initiate and verify require an authenticated session, and initiate also requires a CSRF token. (needs: T12.1, T12.2, T12.3)
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
