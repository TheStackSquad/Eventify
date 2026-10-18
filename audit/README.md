# Eventify: Quality & Capacity Audit

Status: IN PROGRESS | Last updated: YYYY-MM-DD | Commit: <sha>

## 1. Scope
Backend (Go/Gin, Postgres), Next.js frontend, Paystack payment flow.
Out of scope: third-party platform internals (Railway, Vercel, Paystack).

## 2. Method
Static analysis (gosec, staticcheck, govulncheck, gitleaks, npm audit),
Go unit/integration tests, k6 load and concurrency tests, manual review
of payment, auth, and ranking logic.

## 3. Test environment
| Item | Value |
|---|---|
| Hardware / container limits | e.g. local Docker, 1 CPU / 1 GB |
| Postgres | version, pool size |
| Go / k6 versions | |
| Paystack | test mode / stub |

## 4. Results summary
| Area | Metric | Target | Result | Status |
|---|---|---|---|---|
| Secrets | Real secrets in git history | 0 | | |
| Dependencies | Reachable vulnerabilities | 0 | | |
| Tests | Statement coverage (total) | | 17.7% | |
| Tests | Payment/order service coverage | | 0% | |
| Capacity | Max sustained req/s at p95 < X ms | | | |
| Integrity | Oversold tickets across N races | 0 | | |
| Integrity | Duplicate tickets from replayed webhooks | 0 | | |
| Latency | p95 browse / search / checkout | | | |

## 5. Findings
See FINDINGS.md. Totals: Critical _ / High _ / Medium _ / Low _ (open / fixed).

## 6. Reproduce
Commands per test (copied from run-k6.ps1 usage).

## 7. Known limits
Local results are relative, not production capacity claims.

## 8. Changelog
- YYYY-MM-DD: initial baseline