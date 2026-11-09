# audit/runner/schema-inventory.ps1

# audit/runner/schema-inventory.ps1 : read-only schema picture of the rig database. Metadata and counts only.
. (Join-Path $PSScriptRoot '..\core\config.ps1')
$null = Initialize-AuditConfig -Mode tunnel
$out = Join-Path $PSScriptRoot '..\results\raw\schema-inventory.txt'
$tables = "'orders','order_items','payments','tickets','ticket_tiers','events','users','refresh_tokens','token_blacklist','login_attempts','vendors','vendor_stats','vendor_trust_score','profile_views','reviews','inquiries','feedback','email_outbox'"
$q = [ordered]@{
    'row counts'      = "SELECT relname AS table_name, n_live_tup AS approx_rows FROM pg_stat_user_tables ORDER BY relname"
    'columns'         = "SELECT table_name, column_name, data_type, is_nullable AS nullable, left(coalesce(column_default, ''), 40) AS default_value FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ($tables) ORDER BY table_name, ordinal_position"
    'constraints'     = "SELECT conrelid::regclass AS tbl, conname, contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text IN ($tables) ORDER BY 1, 3, 2"
    'indexes'         = "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ($tables) ORDER BY 1, 2"
    'times with no zone' = "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND data_type = 'timestamp without time zone' ORDER BY 1, 2"
    'triggers'        = "SELECT event_object_table AS tbl, trigger_name, action_timing, event_manipulation FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY 1, 2"
    'enums'           = "SELECT t.typname, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY 1"
}
Remove-Item $out -ErrorAction SilentlyContinue
foreach ($k in $q.Keys) {
    "`n===== $k =====" | Add-Content $out
    psql $env:AUDIT_DB_URL -P pager=off -c $q[$k] 2>&1 | Add-Content $out
}
'{0} lines written to {1}' -f (Get-Content $out).Count, $out