# audit/runner/schema-fingerprint.ps1

# audit/runner/schema-fingerprint.ps1 : a short hash of a database's structure, to prove two databases have the same shape.
# Rows are also written to audit/results/raw/fingerprint-<label>.txt so two runs can be compared.
param(
    [string]$DbUrl = '',
    [string]$Label = 'db',
    [switch]$Canonical
)

if (-not $DbUrl) {
    . (Join-Path $PSScriptRoot '..\core\config.ps1')
    $null = Initialize-AuditConfig -Mode tunnel
    $DbUrl = $env:AUDIT_DB_URL
}

$sql = @'
SELECT 'col ' || table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(left(column_default, 60), '')
  FROM information_schema.columns WHERE table_schema = 'public' AND table_name <> 'schema_migrations'
UNION ALL SELECT 'idx ' || tablename || '.' || indexname || ':' || indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename <> 'schema_migrations'
UNION ALL SELECT 'con ' || conrelid::regclass || '.' || conname || ':' || pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace = 'public'::regnamespace AND conrelid::regclass::text <> 'schema_migrations'
UNION ALL SELECT 'trg ' || event_object_table || '.' || trigger_name || ':' || action_timing || ':' || event_manipulation FROM information_schema.triggers WHERE trigger_schema = 'public'
UNION ALL SELECT 'view ' || table_name FROM information_schema.views WHERE table_schema = 'public'
UNION ALL SELECT 'enum ' || t.typname || ':' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname
ORDER BY 1
'@

function ConvertTo-CanonicalRow([string]$row) {
    if ($row -notmatch '^con ' -or $row -notmatch '= ANY \(\(?ARRAY\[') { return $row }
    $i = $row.IndexOf(':CHECK ')
    $col = [regex]::Match($row, '\(\((\w+)\)::(?:text|character varying)\s*=\s*ANY').Groups[1].Value
    $lits = @([regex]::Matches($row, "'((?:[^']|'')*)'::character varying") | ForEach-Object { $_.Groups[1].Value })
    if ($i -lt 0 -or -not $col -or -not $lits.Count) { return $row }
    return ('{0}:CHECK {1} IN ({2})' -f $row.Substring(0, $i), $col, ($lits -join ','))
}

$rows = @(psql $DbUrl -At -c $sql 2>&1)
if ($LASTEXITCODE -ne 0) { throw ('psql failed: ' + ($rows -join ' ')) }

if ($Canonical) {
    $rows = @($rows | ForEach-Object { ConvertTo-CanonicalRow $_ })
}

$fileLabel = if ($Canonical) { "$Label-canonical" } else { $Label }
$out = Join-Path $PSScriptRoot "..\results\raw\fingerprint-$fileLabel.txt"

Set-Content -LiteralPath $out -Value $rows -Encoding UTF8

$sha = [Security.Cryptography.SHA256]::Create()
$hex = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($rows -join "`n"))) | ForEach-Object { $_.ToString('x2') })
'FINGERPRINT {0}  ({1} rows)  [{2}]' -f $hex.Substring(0, 16), $rows.Count, $fileLabel