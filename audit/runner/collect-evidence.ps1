# audit/runner/collect-evidence.ps1

# audit/runner/collect-evidence.ps1 : read-only. Gathers the facts a merge decision needs into one file you can attach.
# It changes nothing except the output file. Its one database probe runs inside a transaction that is rolled back.
param([string]$Branch = 'desh/sub-m10-13', [string]$Out = 'audit/results/raw/m10-13-evidence.txt')
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
. .\audit\core\config.ps1
$null = Initialize-AuditConfig -Mode tunnel
Remove-Item $Out -ErrorAction SilentlyContinue

function Add-Section([string]$Title, [scriptblock]$Body) {
    "`n===== $Title =====" | Add-Content $Out
    try { & $Body 2>&1 | ForEach-Object { "$_" } | Add-Content $Out }
    catch { "ERROR: $($_.Exception.Message)" | Add-Content $Out }
}
function Get-TextSha([string]$Text) {
    $norm = ($Text -replace "`r`n", "`n").TrimEnd()
    $h = [Security.Cryptography.SHA256]::Create()
    (-join ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($norm)) | ForEach-Object { $_.ToString('x2') })).Substring(0, 16)
}
function Invoke-Q([string]$Query) { psql $env:AUDIT_DB_URL -P pager=off -c $Query }

Add-Section 'git: where am I' { git branch --show-current; git branch -vv; git status --short; git log --oneline -3 }
Add-Section "git: $Branch against main" { git log --oneline "main..$Branch"; git diff --name-only "main...$Branch" }

Add-Section 'schema.sql: working tree vs branch tip vs main' {
    $sources = @(
        @{ Name = 'working tree'; Text = (Get-Content audit/docker/schema.sql -Raw) },
        @{ Name = "tip of $Branch"; Text = ((git show "${Branch}:audit/docker/schema.sql") -join "`n") },
        @{ Name = 'main'; Text = ((git show 'main:audit/docker/schema.sql') -join "`n") })
    foreach ($s in $sources) {
        '{0,-26} sha {1}  lines {2,5}  creates migration tables: {3}' -f $s.Name, (Get-TextSha $s.Text), @($s.Text -split "`n").Count, ($s.Text -match 'CREATE TABLE (public\.)?(subscription_payments|webhook_inbox)')
    }
    git diff --stat $Branch -- audit/docker/schema.sql audit/COORDINATION.md
}

Add-Section 'fingerprints, strict (old rig vs rebuilt rig, then rebuilt rig vs fresh volume)' {
    foreach ($pair in @(@('rig-m13', 'rig-rebuilt-m13'), @('rig-rebuilt-m13', 'fresh-m13'))) {
        $a = "audit/results/raw/fingerprint-$($pair[0]).txt"; $b = "audit/results/raw/fingerprint-$($pair[1]).txt"
        if (-not (Test-Path $a) -or -not (Test-Path $b)) { "missing file for $($pair -join ' vs ')"; continue }
        "-- $($pair[0]) vs $($pair[1])"
        $d = @(Compare-Object (Get-Content $a) (Get-Content $b))
        if (-not $d.Count) { '(identical)' } else { $d | ForEach-Object { '{0} {1}' -f $_.SideIndicator, $_.InputObject } }
    }
}

Add-Section 'rig database: migration version, subscriptions constraints and rows' {
    Invoke-Q 'SELECT version, dirty FROM schema_migrations'
    Invoke-Q "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'subscriptions'::regclass AND contype = 'c' ORDER BY 1"
    Invoke-Q 'SELECT status, count(*) FROM subscriptions GROUP BY 1 ORDER BY 1'
}
Add-Section 'rig database: does an "active" subscription pass the table checks? (rolled back, writes nothing)' {
    Invoke-Q "BEGIN; INSERT INTO subscriptions (vendor_id, tier, status, starts_at, expires_at, price, currency, payment_reference, last_payment_date) SELECT v.id, 'basic', 'active', now(), now() + interval '1 day', 350000, 'NGN', 'PROBE-' || gen_random_uuid(), now() FROM vendors v WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.vendor_id = v.id AND s.status = 'active') LIMIT 1; ROLLBACK;"
}
Add-Section 'constraint behaviour (v2): what each CHECK accepts and rejects' { psql $env:AUDIT_DB_URL -q -f audit/sql/constraint-behaviour.sql }

Add-Section 'compose state' {
    docker compose -f audit/docker/docker-compose.loadtest.yml ps -a --format 'table {{.Service}}\t{{.State}}\t{{.ExitCode}}'
    docker compose -f audit/docker/docker-compose.loadtest.yml logs migrate --tail 6
}
Add-Section 'newest reports: header rows and result counts' {
    foreach ($p in 'sub', 'ord') {
        $f = Get-ChildItem audit/results -Filter "$p-matrix-*.md" -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if (-not $f) { "${p}: none"; continue }
        $t = Get-Content $f.FullName -Raw
        '{0}: {1}  PASS {2}  FAIL {3}  SKIP {4}' -f $p, $f.Name, ([regex]::Matches($t, '\*\*PASS\*\*')).Count, ([regex]::Matches($t, '\*\*FAIL\*\*')).Count, ([regex]::Matches($t, '\*\*SKIP\*\*')).Count
        Select-String -Path $f.FullName -Pattern '^\| (Git commit|Database|Mode) ' | ForEach-Object { $_.Line }
    }
    Get-ChildItem audit/results -File | Where-Object { $_.Name -match '\.json\.md$' } | ForEach-Object { 'odd file name: ' + $_.Name }
}
Add-Section 'doctor (tunnel): non-passing lines' { & pwsh -NoProfile -File audit/runner/run-matrix.ps1 -Doctor -Mode tunnel | Where-Object { $_ -match 'FAIL|WARN|Doctor:' } }
Add-Section "gitleaks: main..$Branch" { gitleaks detect --source . --log-opts "main..$Branch" --redact 2>&1 | Select-Object -Last 4 }

$bad = Select-String -Path $Out -Pattern 'sk_(test|live)_|PRIVATE KEY'
"`nWrote {0} lines to {1}. Secret-looking lines: {2}." -f (Get-Content $Out).Count, $Out, @($bad).Count