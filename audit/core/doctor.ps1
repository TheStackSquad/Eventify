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

function Test-AuditEnv([string]$Mode) {
    foreach ($n in 'AUDIT_VENDOR_EMAIL', 'AUDIT_VENDOR_PASSWORD') {
        $ok = [bool](Get-Setting $n)
        Add-Check 'Env' $n $(if ($ok) { 'PASS' } else { 'FAIL' }) $(if ($ok) { 'set' } else { 'not set' }) 'set it in this shell or pass -EnvFile (values are never printed)'
    }
    foreach ($n in 'AUDIT_VENDOR2_EMAIL', 'AUDIT_VENDOR2_PASSWORD') {
        $ok = [bool](Get-Setting $n)
        Add-Check 'Env' $n $(if ($ok) { 'PASS' } else { 'WARN' }) $(if ($ok) { 'set' } else { 'not set: the ownership check (T8) will be skipped' }) ''
    }
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

function Invoke-Doctor($Paths, [string]$Mode, [string]$ComposeFile) {
    Test-Runtime
    Test-Tools $Mode
    Test-Paths $Paths $ComposeFile $Mode
    Test-AuditEnv $Mode
    Test-SecretHygiene $Paths
    if ($Mode -eq 'rig') { Test-Rig $ComposeFile } else { Test-Tunnel }
}