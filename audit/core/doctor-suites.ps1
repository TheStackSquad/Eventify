# audit/ core/doctor-suites.ps1 : checks for suites, migrations and the run lock. Read-only.

function Test-Suites($Paths) {
    $all = @(Get-AuditSuites $Paths.Audit)
    if (-not $all.Count) { Add-Check 'Suites' 'manifests' 'FAIL' 'no audit/suites/*/suite.psd1 found' 'add one per suite (see audit/COORDINATION.md)'; return }
    foreach ($s in $all) {
        $bad = @($s.Problems)
        $name = if ($s.Id) { $s.Id } else { '?' }
        if ($bad.Count) { Add-Check 'Suites' $name 'FAIL' ($bad -join '; ') 'fix the suite.psd1' }
        else { Add-Check 'Suites' $name 'PASS' ('order {0}, modes {1}, needs migration {2}' -f $s.Order, (@($s.Modes) -join '+'), $s.Requires) '' }
    }
}

function Get-MigrationFiles([string]$Dir) {
    @(Get-ChildItem -LiteralPath $Dir -Filter '*.sql' -File -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.Name -match '^(\d+)_(.+)\.(up|down)\.sql$') { [pscustomobject]@{ Number = [int]$Matches[1]; Name = $_.Name; Direction = $Matches[3]; Slug = $Matches[2] } }
    })
}

function Test-MigrationOrder($Paths) {
    $files = @(Get-MigrationFiles (Join-Path $Paths.Backend 'migrations'))
    $ups = @($files | Where-Object { $_.Direction -eq 'up' })
    $missingDown = @($ups | Where-Object { $n = $_.Number; $s = $_.Slug; -not ($files | Where-Object { $_.Direction -eq 'down' -and $_.Number -eq $n -and $_.Slug -eq $s }) })
    Add-Check 'Migrations' 'down files' $(if ($missingDown.Count) { 'FAIL' } else { 'PASS' }) $(if ($missingDown.Count) { 'no down file for: ' + (($missingDown | ForEach-Object { $_.Name }) -join ', ') } else { "$($ups.Count) migrations, each with a down file" }) 'add the matching .down.sql'
    $dupes = @($ups | Group-Object Number | Where-Object { $_.Count -gt 1 })
    Add-Check 'Migrations' 'unique numbers' $(if ($dupes.Count) { 'FAIL' } else { 'PASS' }) $(if ($dupes.Count) { 'used twice: ' + (($dupes | ForEach-Object { $_.Name }) -join ', ') } else { 'no number is used twice' }) 'renumber one of them (claim a number in audit/COORDINATION.md first)'

    git -C $Paths.Repo rev-parse --verify -q origin/main 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { Add-Check 'Migrations' 'order vs main' 'WARN' 'origin/main not found' 'run: git fetch origin'; return }
    $onMain = @(git -C $Paths.Repo ls-tree -r --name-only origin/main -- backend/migrations | ForEach-Object { Split-Path $_ -Leaf })
    $mainMax = 0
    foreach ($n in $onMain) { if ($n -match '^(\d+)_' -and [int]$Matches[1] -gt $mainMax) { $mainMax = [int]$Matches[1] } }
    $mine = @($files | Where-Object { $onMain -notcontains $_.Name })
    $low = @($mine | Where-Object { $_.Number -le $mainMax })
    Add-Check 'Migrations' 'order vs main' $(if ($low.Count) { 'FAIL' } else { 'PASS' }) $(if ($low.Count) { "not on origin/main but numbered at or below its highest (m$mainMax): " + (($low | ForEach-Object { $_.Name }) -join ', ') } else { "$($mine.Count) new file(s), all above main's highest (m$mainMax)" }) 'renumber before merging: golang-migrate never applies a number below the database version'
}

# The snapshot is the pre-migration baseline: it must not already contain tables that migrations create.
function Test-SnapshotBaseline($Paths) {
    $snap = Join-Path $Paths.Audit 'docker/schema.sql'
    if (-not (Test-Path -LiteralPath $snap)) { Add-Check 'Migrations' 'baseline snapshot' 'SKIP' 'audit/docker/schema.sql not found' ''; return }
    $text = Get-Content -LiteralPath $snap -Raw
    $pattern = '(?im)create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)'
    $made = foreach ($f in Get-ChildItem (Join-Path $Paths.Backend 'migrations') -Filter '*.up.sql') {
        foreach ($m in [regex]::Matches((Get-Content $f.FullName -Raw), $pattern)) { $m.Groups[1].Value }
    }
    $clash = @($made | Sort-Object -Unique | Where-Object { $text -match ('(?im)create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?' + [regex]::Escape($_) + '\b') })
    Add-Check 'Migrations' 'baseline snapshot' $(if ($clash.Count) { 'FAIL' } else { 'PASS' }) $(if ($clash.Count) { 'schema.sql already creates: ' + ($clash -join ', ') } else { 'schema.sql holds no table that a migration creates' }) 'schema.sql must be regenerated from a pre-migration database (COORDINATION: baseline rule)'
}

function Get-DbMigrationState([string]$Mode, [string]$Compose) {
    $sql = "SELECT version::text || '|' || (CASE WHEN dirty THEN 'dirty' ELSE 'clean' END) FROM schema_migrations LIMIT 1"
    if ($Mode -eq 'tunnel') {
        if (-not (Get-Setting 'AUDIT_DB_URL') -or -not (Get-Command psql -ErrorAction SilentlyContinue)) { return $null }
        $out = psql (Get-Setting 'AUDIT_DB_URL') -At -c $sql 2>$null
    }
    else {
        if (-not (Test-StackRunning $Compose)) { return $null }
        $out = docker compose -f $Compose exec -T db psql -U loadtest -d eventify_loadtest -At -c $sql 2>$null
    }
    if ($LASTEXITCODE -ne 0 -or -not $out) { return $null }
    $p = ([string]($out | Select-Object -First 1)) -split '\|'
    return [pscustomobject]@{ Version = [int]$p[0]; Dirty = ($p[1] -eq 'dirty') }
}

function Test-SuiteRequires($Paths, [string]$Mode, [string]$Compose) {
    $ups = @(Get-MigrationFiles (Join-Path $Paths.Backend 'migrations') | Where-Object { $_.Direction -eq 'up' })
    $top = if ($ups.Count) { [int](($ups | Measure-Object Number -Maximum).Maximum) } else { 0 }
    foreach ($s in @(Get-AuditSuites $Paths.Audit | Where-Object { -not @($_.Problems).Count })) {
        $ok = [int]$s.Requires -le $top
        Add-Check 'Suites' ("{0} needs m{1}" -f $s.Id, $s.Requires) $(if ($ok) { 'PASS' } else { 'FAIL' }) "migration files go up to m$top" 'the suite needs a migration that does not exist yet'
    }
    $st = Get-DbMigrationState $Mode $Compose
    if (-not $st) { Add-Check 'Migrations' 'database version' 'SKIP' 'database not reachable yet (use -Up)' ''; return }
    if ($st.Dirty) { Add-Check 'Migrations' 'database version' 'FAIL' "m$($st.Version) is dirty" 'fix the failed migration, then: migrate force <last good version>' }
    elseif ($st.Version -lt $top) { Add-Check 'Migrations' 'database version' 'WARN' "database at m$($st.Version), files up to m$top" 'run -Up (it applies the rest)' }
    else { Add-Check 'Migrations' 'database version' 'PASS' "m$($st.Version)" '' }
}

function Test-RunLock {
    $lock = Read-RunLock (Get-LockPath)
    if (-not $lock) { Add-Check 'Run lock' 'state' 'PASS' 'free' ''; return }
    $what = if (Test-LockStale $lock) { 'stale lock (run with -Force to clear it)' } else { 'another run is in progress' }
    Add-Check 'Run lock' 'state' 'WARN' ("{0}: suite {1}, mode {2}, pid {3}, since {4}" -f $what, $lock.suite, $lock.mode, $lock.pid, $lock.started) ''
}