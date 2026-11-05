# audit/core/paths.ps1

# core/paths.ps1 : find the repo root and the folders the harness uses.
function Get-AuditPaths([string]$Start) {
    $repo = $Start
    while (-not (Test-Path -LiteralPath ([IO.Path]::Combine($repo, 'backend')))) {
        $parent = Split-Path -Parent $repo
        if (-not $parent -or $parent -eq $repo) { throw "Cannot find the repo root (a folder containing 'backend') above $Start" }
        $repo = $parent
    }
    [pscustomobject]@{
        Repo    = $repo
        Audit   = [IO.Path]::Combine($repo, 'audit')
        Backend = [IO.Path]::Combine($repo, 'backend')
        Core    = [IO.Path]::Combine($repo, 'audit', 'core')
        Results = [IO.Path]::Combine($repo, 'audit', 'results')
    }
}