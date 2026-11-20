function Assert-RigMigrationsApplied([string]$ComposeFile) {
    $log = (& docker compose -f $ComposeFile logs migrate --tail 80 2>&1 | Out-String)
    $fix = "The rig database is disposable. Rebuild it from this branch: docker compose -f $ComposeFile down -v ; docker compose -f $ComposeFile up -d --build"
    if ($log -match 'no migration found for version (\d+)') {
        throw "The rig database is at migration $($Matches[1]) but backend\migrations on this branch has no such file (another branch migrated the shared volume further). $fix"
    }
    if ($log -match 'Dirty database version (\d+)') {
        throw "A migration stopped half way (dirty at version $($Matches[1])). $fix"
    }
}