# audit/runner/clear-auth-accounts.ps1 : removes the audit_auth_* test accounts from the rig database (localhost only).
# Run it before a migration that adds a uniqueness rule: earlier AUTH runs left accounts that differ only by letter case.
. (Join-Path $PSScriptRoot '..\core\config.ps1')
$null = Initialize-AuditConfig -Mode tunnel
if ($env:AUDIT_DB_URL -notmatch '@(localhost|127\.0\.0\.1)[:/]') { throw 'AUDIT_DB_URL must point at localhost' }
psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q -c "DELETE FROM login_attempts WHERE starts_with(lower(email), 'audit_auth_'); DELETE FROM users WHERE starts_with(lower(email), 'audit_auth_') AND lower(email) LIKE '%@example.com'"
if ($LASTEXITCODE -ne 0) { throw 'cleanup failed' }
'audit_auth_* accounts removed'
