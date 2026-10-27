
# Eventify: milestone tracker
Legend: x = done, ~ = partial, - = not started. Update after every session.

| # | Area | Reviewed | Patched | Tested | Perf data | Open items |
|---|---|---|---|---|---|---|
| M0 | Containment (keys, secrets, history, repo visibility) | x | x | n/a | n/a | optional history scrub; secret scanning; TICKET_SIGNING_SECRET set on Railway |
| M1 | Order and payments | x | ~ | ~ | ~ | frontend hook patch; owner check on verify; webhook hardening; late-payment policy; reaper race test (needs testhelper files); fee cliff decision; post-patch baseline |
| M2 | Email outbox and worker | ~ | ~ | - | - | M2a written, not yet applied; M2b subscription emails onto outbox; M2c failure tests; production backlog decision |
| M3 | Auth and sessions | - | - | ~ | - | forgot-password timing; login latency; refresh rotation; key loader |
| M4 | Edge protection | x | ~ | ~ | - | limiter spoofing and memory; trusted proxies; body limits; CSRF flags |
| M5 | Subscriptions | - | - | - | - | whole flow |
| M6 | Tickets and gate | ~ | - | - | - | code collisions; signing secret; check-in double scan |
| M7 | Read path and ranking | ~ | - | ~ | ~ | 50k-row seed; EXPLAIN; PVS recalculation; leaderboard tests |
| M8 | Platform reliability | ~ | - | - | ~ | worker shutdown and panics; pool; replicas; health checks |
| M9 | Capacity and endurance | n/a | n/a | n/a | - | target, stress, soak, spike, breakpoint, 2 replicas |
| M10 | Release readiness | ~ | - | - | n/a | fix 3 broken test packages; CI green; coverage; dependency upgrades; evidence README |
| Set-Content