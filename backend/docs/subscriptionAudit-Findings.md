# Subscription Feature: Findings, Decisions and Progress

Project: Eventify (Go/Gin/PostgreSQL backend, Next.js frontend)
Branch: `desh/cleanUp`
Last updated: 2026-10-23

This is the living record of the subscription audit. After each milestone, update sections 2, 4 and 6.

## 1. Goal and working method

Goal: a subscription feature that is sound as a business and as an architecture, and that can be proven to investors.

- The server is the source of truth for price, tier, state and ownership. The client only renders what the server says.
- Work goes server first, then client. Changes are small patches, not rewrites.
- Every promise on the pricing page must be enforced by backend logic and covered by a test, or be removed from the page.
- Every milestone ends with Go tests. The final suite plus a promise matrix is the investor evidence.
- Guarantee deliverables and exposure rules. Never promise outcomes (gigs, "3x visibility"). Measure them and publish only what the data supports.

### Status at a glance (2026-10-23)

- Payment core (pricing, ledger, settlement, webhooks): code written. Repository and integration suites are green when run serially (`go test -p 1 ./pkg/...`).
- `services/subscription` unit tests: red until the seven legacy tests are replaced and `VerifyAndFinalize` / `settle` match the reviewed design (see F50).
- Not run yet: the end-to-end ngrok matrix (T1 to T9).
- Product-value work (M7: making tier promises real) has not started.
- Nothing has been deployed. The app has not gone live.

## 2. Milestone status

| ID | Milestone | Status | Evidence / note |
|----|-----------|--------|-----------------|
| M0 | Trace and baseline | Done | Handlers, services, repos, models, DB triggers and frontend read in full |
| M1 | Business rules R1 to R8, prices | Done | Section 3 |
| M2 | Pricing integrity | Done | `models.PriceKobo`, public `/plans`, unit tests green |
| M3 | Payment foundation: migrations, ledger, ledger-first initiate | Done | Migration 000001 applied to `Eventify` and `Eventify_test`; unit and repository tests green |
| M4 | Settlement: exactly-once apply, renewal, ownership, review queue | Done in the reviewed design | Repository concurrency tests green; service layer must match the reviewed file (F50) |
| M5 | Webhook hardening and ngrok tests | In progress | Subscription side done; order-side patch issued; T1 to T9 not run |
| M6 | Time and lifecycle | Not started | F19 to F21 |
| M7 | Promise delivery: catalog, gates, ranking and placement, measurement | Audit done, build not started | F40 to F43 |
| M8 | Client renders server data | Not started | F30 to F35 |
| M9 | Investor suite, promise matrix, test isolation | Started | F18, F23, F44 |

## 3. Decisions log

Business rules (agreed):

- R1: One price per tier, in kobo, set on the server and exposed through a plans endpoint. The UI only displays it.
- R2: Initiate rejects free or unknown tiers. A vendor with an active plan may only renew the same tier. Upgrades are deferred.
- R3: Every verified Paystack payment is credited at most once, keyed by Paystack reference (the `subscription_payments` ledger).
- R4: Renewal extends the active row. New expiry = max(now, current expiry) plus one month, clamped at month end.
- R5: A paid but unusable payment (amount or currency mismatch, tier clash) is recorded as `needs_review`. It is never silently dropped and never cancels anything.
- R6: One webhook URL and one dispatcher. Permanent failures return 200 after logging. Only transient failures return 5xx.
- R7: The database trigger owns `vendors.subscription_tier`. Timestamps are UTC.
- R8: Expiry is enforced at read time and by the worker, which also runs once at boot.

Prices (monthly): Basic 3,500 naira (350,000 kobo), Premium 10,000 naira (1,000,000 kobo), Featured 25,000 naira (2,500,000 kobo).

Product decisions:

- No auto-renew. `auto_renew` is dropped and reminders go to every active vendor. Promise: "No auto-charge. Your plan ends on its expiry date unless you renew."
- No cancel or downgrade feature, so "cancel anytime" and "downgrade anytime" come off the UI.
- Positional promises ("#1", "first position") become placement bands: all Featured above all Premium, above Basic, above Free. Merit and fair rotation decide order inside a band.
- Inquiries go to one individual vendor by design, so "Priority Delivery +24h / +48h earlier" is removed.
- "500+ vendors" is a year-one projection. The backend serves the live active-vendor count rounded down to a milestone (10, 25, 50, 100, 250, 500, 1000 and so on), and the UI shows the line only when it is true.
- Webhooks: one URL, `/api/webhooks/paystack`, routing to orders or subscriptions by metadata. The old `/subscription/webhook` route is to be removed (confirm).
- Migrations: golang-migrate, files in `backend/migrations/`. `postgres/init.sql` remains the baseline.

## 4. Findings register

Severity: Critical, High, Med, Low. Status: Fixed, Fix issued (apply and verify), Open.

### Payments and webhooks (backend)

| ID | Sev | Finding | Status | Where |
|----|-----|---------|--------|-------|
| F01 | High | Featured charged 25,000 naira while the UI showed 20,000 | Fixed (UI constants patched; UI reads `/plans` in M8) | M2 |
| F02 | Med | Unknown tier priced at 0; only free was rejected | Fixed | M2, M3 |
| F03 | High | A cancelled or expired subscription reported "activated" | Fixed | M4 |
| F04 | Med | No vendor ownership check on verify | Fixed in the reviewed design (see F50) | M4 |
| F05 | Med | Paystack link created before the DB row existed | Fixed (ledger first) | M3 |
| F06 | High | Duplicate pending rows; a second payment lost to the unique-active-vendor index | Fixed (no pending rows; per-vendor serialised settle; renewal extends the row) | M3, M4 |
| F07 | Med | Amount mismatch cancelled the subscription and left no trail | Fixed (`needs_review`) | M4 |
| F08 | Low | Webhook attempt counter never counted (matched a NULL reference) | Fixed (counts on the ledger) | M5 |
| F09 | High | Webhook retry semantics wrong (500 for permanent errors, then 200 for everything) | Fixed for subscriptions; order side fix issued | M5 |
| F10 | High | Paystack dashboard pointed at the frontend root; two webhook endpoints | Fixed in test mode (ngrok URL); live URL open | launch checklist |
| F11 | High | `RunInTransaction` swallowed commit errors | Fixed | M4 |
| F12 | Med | Expiry worker could expire a just-renewed row; lock order could deadlock with settle | Fixed (guarded UPDATE, vendor-first lock) | M4 |
| F13 | Low | Vendor tier had three writers | Fixed (trigger only) | M4 |
| F14 | Low | `AddDate(0,1,0)` overflowed at month end | Fixed (`NextExpiry`) | M4 |
| F15 | Med | Paystack client: no timeout, unescaped reference in URL, untyped errors | Fixed | M5 |
| F16 | High | No reconciliation for lost webhooks | Fixed (worker task, 10 minute to 72 hour window) | M5 |
| F17 | Low | Handlers had no deadlines and leaked raw error text | Fixed for initiate and verify | M3, M4 |
| F18 | Med | `AssertNotCalled(t, "X")` with no arguments cannot fail | Open (convert to `AssertNumberOfCalls`) | M9 |
| F19 | Med | Mixed time conventions: Go writes UTC wall-clock, Postgres `NOW()` writes Lagos wall-clock into `timestamp without time zone`; trigger and worker compare to `NOW()` | Open (per-column timestamptz migration) | M6 |
| F20 | Med | Expiry not enforced at read time; worker's first run is one full interval after boot | Open | M6 |
| F21 | Med | Reminders require `auto_renew = true`, which the UI never sends; one-day windows can be missed after downtime | Open | M6 |
| F22 | High | Order webhook swallowed database errors as "not found" and ignored the event name | Fix issued | M5 |
| F23 | High | All DB test packages share `Eventify_test`; parallel packages truncate each other | Workaround verified (`-p 1`); durable fix open | M9 |
| F24 | Med | No migration tool | Fixed (golang-migrate) | M3 |
| F44 | Low | `NewTestDB` loads `.env.test` from four directories up, one above the repo root | Open | M9 |
| F50 | Critical | Working copy of `VerifyAndFinalize` / `settle` diverged from the reviewed design. It activated on `transaction.Status` (API call success) without checking `Data.Status == "success"`, so an unpaid reference could be activated. It copied paid amount and currency from the ledger, so the mismatch check could never fire. It ignored `vendorID`, and it called Paystack twice. | Fix issued 2026-10-23 (whole-file replacement and regression tests); verify with unit tests and T9 | M4 |

### Frontend

| ID | Sev | Finding | Status | Where |
|----|-----|---------|--------|-------|
| F30 | High | Tier modal reads `initialTier` only on first render, so a click on Basic can open with Premium preselected | Open | M8 |
| F31 | Med | Verify page shows "pending, will update automatically" for every failure; success copy always says "premium" | Open | M8 |
| F32 | Low | Free tier selectable in the modal; paying for it returns 400 | Open | M8 |
| F33 | Low | React Query v5 misuse: `onSuccess`/`onError` in `useQuery` ignored, `isLoading` on mutations, array-form `invalidateQueries`, abort signal unused | Open | M8 |
| F34 | Med | Three price sources (two constants files plus backend); marketing numbers hard-coded | Open | M8 |
| F35 | High | Unsubstantiated claims ("500+ vendors", "3x to 10x visibility", "~8,000 views per month"); "cancel anytime" with no cancel feature | Open | M7d, M8 |

### Promise delivery (audit result)

| ID | Sev | Finding | Status | Where |
|----|-----|---------|--------|-------|
| F40 | Critical | Only three tier behaviours exist: payment sets the tier, flags are returned in API responses, and the leaderboard view includes only premium and featured vendors. Flags with no consumers: `PriorityListing`, `FeaturedPlacement`, `CategoryBoost`, `HomepageRotation`, `VerifiedBadge`, `GoldBadge`, `DetailedAnalytics`, `DirectMessagePriority`, `BasicAnalytics`, `EnhancedProfile`. No code for search boost, For-You placement, hero carousel, category spotlight or badges. | Open | M7 |
| F41 | High | No photo, video or description quota is enforced anywhere in Go | Open | M7b |
| F42 | High | No impression tracking (only profile views and `view_count`) | Open | M7d |
| F43 | Med | Promises that cannot be delivered with current data: priority delivery (inquiries are one-to-one), response tracking (no reply data), revenue conversion (no hire or revenue data), geographic heatmap (no viewer location) | Decisions pending | M7a |

## 5. What has been built

Migrations:
- `backend/migrations/000001_subscription_payments.up.sql` and `.down.sql`

Models:
- `pkg/models/subscription.go`: single price table (`PriceKobo`, `PaidTiers`, `Plan`, `GetPlans`); `GetPricing` kept as deprecated
- `pkg/models/subscription_payment.go`: ledger model and statuses
- `pkg/models/subscription_period.go`: `NextExpiry` with month-end clamping

Repository (`pkg/repository/subscription/`):
- `queries_payments.go`: `CreatePayment`, `GetPaymentByReference`, `MarkPaymentFailed`, `ListInitiatedBetween`, `AbandonStalePayments`
- `queries_settle.go`: `SettlePayment` (ledger row lock, vendor lock, amount and currency check, renewal, lapsed-row expiry, review queue)
- `queries_lifecycle.go`: `RunInTransaction` commit fix, attempt counter on the ledger

Services:
- `pkg/services/subscription/subscription_errors.go`: typed errors and `IsRetryable`
- `pkg/services/subscription/subscription_payment.go`: ledger-first initiate, verify, settle, webhook
- `pkg/services/subscription/subscription_reconcile.go`: reconciliation task
- `pkg/services/subscription/subscription_expiry.go`: guarded expiry with vendor-first lock
- `pkg/services/paystack/paystack.go`: timeout, escaped reference, typed errors

Handlers and routes:
- `/api/v1/subscription/plans` (public), `/initiate`, `/me`, `/verify/:reference`
- Single webhook dispatcher at `/api/webhooks/paystack`

## 6. Proof so far

Green (serial run, 2026-10-23):
- Unit: `models`, `paystack`, `order`, `middleware`, `auth`, `email`, `jwt`.
- Integration: `repository/subscription` (ledger, settlement, renewal, lapsed-row replacement, mismatch hold, no-op repeat, eight concurrent settles of one reference apply once, two concurrent payments for one vendor are both credited with one active row), `repository/vendor`, `repository/auth`, `services/vendor`.

Red:
- `services/subscription`: seven legacy tests plus a reconcile test, all caused by F50. Resolved by the replacement file and the new tests.

Not run yet:
- The ngrok matrix in section 8.

How to run:

```bash
cd backend
go build ./... && go vet ./pkg/...
go test -p 1 ./pkg/...          # DB suites share one database; do not run packages in parallel
migrate -path migrations -database "$DATABASE_URL" up
```

## 7. Open decisions

- Response tracking: add a reply timestamp to inquiries so "average response time" is real (recommended), or remove the promise.
- Revenue conversion: remove "+ Revenue" for now, or add a "mark as hired, with value" step later.
- Geographic heatmap: defer until viewer-location collection and its data-protection design exist.
- Priority delivery replacement: remove the row (recommended) or offer instant inquiry alerts for paid tiers.
- Placement bands: whether to cap Featured seats per category once there is data.

## 8. Test matrix (ngrok, test mode)

Prerequisites: backend running with the test `PAYSTACK_SECRET_KEY`; `FRONTEND_URL` set; ngrok forwarding to the backend port; the test webhook URL in the Paystack dashboard set to `<ngrok-url>/api/webhooks/paystack`; `SUBSCRIPTION_WORKER_INTERVAL=1m` for T4.

| # | Scenario | Expected |
|---|----------|----------|
| T1 | Pay for Premium | Webhook 200. Ledger `applied`, one active row, expiry about one month out, vendor tier updated, attempts at least 1 |
| T2 | Replay the webhook twice from the ngrok inspector | 200 each time. Expiry unchanged. One active row |
| T3 | Forged webhook with a bad signature | 401, no database change |
| T4 | Stop ngrok, pay, never return to the callback page | After about 11 minutes the reconcile task applies it |
| T5 | Raise `amount_kobo` in the ledger after initiate, then pay | `needs_review` with a reason, no active row, verify page shows a 409 under-review message |
| T6 | Rename `subscription_payments`, replay the webhook, rename back, replay | First replay 500, second 200 and applied |
| T7 | Renew the same tier, then try another tier | Same tier: expiry extended, one row. Other tier: 409 `ACTIVE_PLAN_EXISTS` |
| T8 | Verify another vendor's reference | 404 `PAYMENT_NOT_FOUND` |
| T9 | Initiate, do not pay, call verify | 422 `PAYMENT_NOT_SUCCESSFUL`, no active row |

State checks:

```sql
SELECT reference, status, webhook_attempts, review_reason FROM subscription_payments ORDER BY created_at DESC LIMIT 5;
SELECT tier, status, expires_at, payment_reference FROM subscriptions ORDER BY created_at DESC LIMIT 5;
```

## 9. Next actions

1. Apply the `subscription_payment.go` replacement, the test changes and the order-webhook patch. Re-run `go test -p 1 ./pkg/...` until green. Commit and push.
2. Run T1 to T9 and record results here.
3. M6: per-column timestamptz migration, read-time expiry, worker run at boot, reminders for every active vendor.
4. M7a: settle the open decisions in section 7. Then M7b (quotas and gates), M7c (ranking and placement bands), M7d (impressions, funnel, public stats).
5. M8: client reads `/plans`, fixes the modal and verify page, removes invented numbers.
6. M9: durable test-DB isolation, promise matrix (each pricing-page row mapped to enforcing code and a test), coverage report, architecture note.

## 10. Launch checklist

- Live webhook URL set in the Paystack dashboard (live mode) and live keys in the environment.
- Remove `TEST-FIXTURE` rows from any shared database.
- Confirm the old `/subscription/webhook` route is gone.
- Staging run of T1 to T9 with live-like configuration.
- Credentials only in `.env` files that are not committed. Never paste connection strings with passwords into tickets or chats.

## 11. Environment notes

- Databases: `Eventify` (development) and `Eventify_test` (integration tests). Both need migrations applied.
- Time zone: the database session runs in `Africa/Lagos`. See F19 before trusting any `NOW()` comparison on `timestamp without time zone` columns.
- Test DB access: `POSTGRES_TEST_URI`, or `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_PORT`, optionally from `.env.test`.