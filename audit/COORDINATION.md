# audit/ COORDINATION.md

DECISIONS v1 (ORD agent + SUB/rig agent, applied by the owner)
- Manifests: audit/suites/<id>/suite.psd1 (Id, Title, Tags, Modes, Orchestrator, NeedsStub,
  NeedsTunnel, CheckPrefix, FixturePrefix, Requires, Order, Destructive). Direct launchers
  work until the manifest-scanning launch.ps1 lands (SUB agent, L1).
- Run lock: audit/results/.run.lock via core/lock.ps1 (Enter-RunLock/Exit-RunLock, try/finally).
- Findings: SUB/shared F1-F199 (SUB is at F96), ORD F200-F299, ANL F300-F399, AUTH F400-F499.
  Each suite has its own findings file; audit/FINDINGS.md holds the index.
- Migrations: append-only, claim a number here before use, renumber before merge if a
  lower number would land after a higher one. schema.sql is the pre-migration baseline and is
  never regenerated from a migrated DB. Rig runs migrate up on every -Up.
- Ownership: SUB = dispatcher HandlePaystackWebhook, handleSubscriptionWebhook, webhook inbox,
  subscription code. ORD = order webhook handler (own file), order service/repo/handler,
  serviceorder.IsRetryable, pricing, ticket utils. New files in frozen packages are allowed;
  edits to existing functions go by request; router.go/main.go get one-line
  // WIRING:<suite> additions only.
- Held payments: commit the review row and alert in the same transaction, answer 200, mark the
  inbox row processed with last_error "HELD:...". No new inbox status.
- Stub: additive only, new files, never touch /__reset. Webhook bodies come from real fixtures.
- Branches: desh/ord-*, desh/sub-*. The owner applies patches and merges.
