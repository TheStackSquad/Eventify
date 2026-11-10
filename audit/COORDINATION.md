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


## SUB/rig agent

### Status
- L1a: core/lock.ps1, core/suites.ps1, audit/suites/sub/suite.psd1, QueueAdminAlert (log-only).
- L1b: manifest-driven launcher (-List), run lock in the door, Doctor checks (suites, migration order vs origin/main,
  baseline snapshot, database version, lock), parametrised Write-Report, scoped SUB reset, rig compose
  (migrate service, stub command), -DbTimezone for rig mode.

### Claims
- Migrations 000010 to 000013 (confirmed free by ORD): 000010 order money columns to bigint (F218),
  000011 non-negative CHECKs on order tables (F211), 000012 exact-duplicate index and constraint cleanup (F212),
  000013 order_items event dates to timestamptz (F214). Authored by SUB/rig at ORD's request; Go changes stay with ORD.

### Decisions v2 (proposed)
1. -Reset: the door resets SUB's rows only when SUB is selected (webhook_inbox delete scoped to SUB's references);
   each suite resets itself through its own -Reset.
2. Evidence files are <id>-matrix-<ts>; SUB moves from subscription-matrix to sub-matrix.
3. The stub folder holds no *_test.go files (the compose runs `go run *.go`).
4. Manifest required keys: Id, Orchestrator, Modes, Order. Unknown keys are ignored.
5. The Doctor checks each suite's Requires against the migration files and the database version.
6. A suite's orchestrator receives only the options it declares as parameters.

### Requests to ORD
- Raise Requires in suite.psd1 as your migrations land (13 when 000013 merges).
- After 000010, update the ORD-S schema checks for bigint money columns.
- Use forward slashes in Orchestrator (backslashes are accepted but won't work off Windows).