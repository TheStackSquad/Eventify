# audit/core/reset.ps1

# core/reset.ps1 : the SUB suite's reset. Removes only the audit vendors' rows and the stored webhooks that belong to them.
# Other suites reset themselves through their own -Reset. Loaded after tunnel.ps1, so this definition wins.
function Invoke-AuditReset {
    if ((Get-Setting 'AUDIT_DB_URL') -notmatch '@(localhost|127\.0\.0\.1)[:/]') { throw 'Reset only runs against a localhost database' }
    Write-Host "Resetting the audit vendors' payments, plans and their stored webhooks..." -ForegroundColor Yellow
    $sql = @'
CREATE TEMP TABLE _audit_v AS
  SELECT v.id::text AS vendor_id FROM vendors v JOIN users u ON u.id = v.owner_id WHERE u.email LIKE 'audit_vendor%';
DELETE FROM webhook_inbox w
 WHERE w.reference IN (SELECT p.reference FROM subscription_payments p WHERE p.vendor_id::text IN (SELECT vendor_id FROM _audit_v))
    OR EXISTS (SELECT 1 FROM _audit_v a WHERE position(a.vendor_id in encode(w.body, 'escape')) > 0);
DELETE FROM subscription_payments WHERE vendor_id::text IN (SELECT vendor_id FROM _audit_v);
DELETE FROM subscriptions WHERE vendor_id::text IN (SELECT vendor_id FROM _audit_v);
UPDATE vendors SET subscription_tier = 'free' WHERE id::text IN (SELECT vendor_id FROM _audit_v);
'@
    psql (Get-Setting 'AUDIT_DB_URL') -v ON_ERROR_STOP=1 -q -c $sql 2>&1 | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'Reset failed' }
}