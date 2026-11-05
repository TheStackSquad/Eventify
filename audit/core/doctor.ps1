# audit/core/doctor.ps1

# core/doctor.ps1 : runtime, paths, environment and secret-hygiene checks. Read-only.
function Test-Runtime {
    $os = [Runtime.InteropServices.RuntimeInformation]::OSDescription
    Add-Check 'Runtime' 'PowerShell' 'PASS' ('{0} on {1}' -f $PSVersionTable.PSVersion, $os) ''
}

function Test-Paths($Paths, [string]$Compose, [string]$Mode) {
    Add-Check 'Paths' 'repo root' 'PASS' $Paths.Repo ''
    $need = @('backend/go.mod', 'audit/core/orchestrate.ps1', 'audit/matrix/helpers.ps1', 'audit/matrix/setup.ps1', 'audit/matrix/checks.ps1')
    if ($Mode -eq 'rig') { $need += $Compose }
    foreach ($rel in $need) {
        $ok = Test-Path -LiteralPath (Join-Path $Paths.Repo $rel)
        Add-Check 'Paths' $rel $(if ($ok) { 'PASS' } else { 'FAIL' }) '' 'missing: restore it from git or fix the path'
    }
}

function Test-AuditEnv([string]$Mode, [string]$EnvFile) {
    try { $cfg = Import-AuditConfig -Mode $Mode -EnvFile $EnvFile }
    catch { Add-Check 'Config' 'env file' 'FAIL' $_.Exception.Message 'copy audit\docker\.env.example to audit\docker\.env and fill it in'; return }
    Add-Check 'Config' 'file' 'PASS' $cfg.File ''
    foreach ($r in $cfg.Results) { Add-Check 'Config' $r.Name $r.Status $r.Detail $r.Fix }
}

function Test-MigrationsTracked($Paths) {
    $dirty = @(git -C $Paths.Repo status --porcelain -- backend/migrations)
    $bad = $dirty.Count -gt 0
    Add-Check 'Migrations' 'committed' $(if ($bad) { 'FAIL' } else { 'PASS' }) $(if ($bad) { "$($dirty.Count) migration file(s) not committed" } else { 'all migration files are committed' }) 'commit backend/migrations: the code depends on them (finding F82)'
}

# Files that must never reach git: they have to be ignored, and never tracked.
function Test-SecretHygiene($Paths) {
    foreach ($f in 'audit/docker/.env', 'audit/config/audit.env', 'backend/.env', '.env', 'eventify_backup.dump') {
        if (-not (Test-Path -LiteralPath (Join-Path $Paths.Repo $f))) { continue }
        git -C $Paths.Repo ls-files --error-unmatch $f 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { Add-Check 'Secrets' $f 'FAIL' 'tracked by git' "git rm --cached $f, then add it to .gitignore"; continue }
        git -C $Paths.Repo check-ignore -q $f
        if ($LASTEXITCODE -eq 0) { Add-Check 'Secrets' $f 'PASS' 'ignored by git' '' }
        else { Add-Check 'Secrets' $f 'FAIL' 'exists but is not ignored (git add . would commit it)' "add $f to .gitignore" }
    }
}

function Invoke-Doctor($Paths, [string]$Mode, [string]$ComposeFile, [string]$EnvFile = '') {
    Test-Runtime
    Test-Tools $Mode
    Test-Paths $Paths $ComposeFile $Mode
    Test-AuditEnv $Mode $EnvFile
    Test-MigrationsTracked $Paths
    Test-SecretHygiene $Paths
    if ($Mode -eq 'rig') { Test-Rig $ComposeFile } else { Test-Tunnel }
}