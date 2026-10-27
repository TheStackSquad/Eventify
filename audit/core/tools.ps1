# audit/core/tools.ps1

# core/tools.ps1 : which tools each mode needs, whether they are installed, and their versions.
function Get-ToolTable {
    $curl = if ($IsWindows) { 'curl.exe' } else { 'curl' }
    @(
        @{ Name = 'git';    Cmd = 'git';    VArgs = @('--version'); Modes = @('rig', 'tunnel'); Need = $true;  Fix = 'https://git-scm.com/downloads' }
        @{ Name = 'curl';   Cmd = $curl;    VArgs = @('--version'); Modes = @('rig', 'tunnel'); Need = $true;  Fix = 'Windows 10+ ships curl.exe; on Linux install curl' }
        @{ Name = 'psql';   Cmd = 'psql';   VArgs = @('--version'); Modes = @('rig', 'tunnel'); Need = $true;  Fix = 'install the PostgreSQL client tools (the matrix uses host psql until P3)' }
        @{ Name = 'docker'; Cmd = 'docker'; VArgs = @('--version'); Modes = @('rig');           Need = $true;  Fix = 'install Docker Desktop' }
        @{ Name = 'go';     Cmd = 'go';     VArgs = @('version');   Modes = @('tunnel');        Need = $true;  Fix = 'winget install GoLang.Go' }
        @{ Name = 'ngrok';  Cmd = 'ngrok';  VArgs = @('version');   Modes = @('tunnel');        Need = $true;  Fix = 'winget install ngrok.ngrok' }
        @{ Name = 'k6';     Cmd = 'k6';     VArgs = @('version');   Modes = @('rig');           Need = $false; Fix = 'winget install k6 (the performance suites need it)' }
    )
}

function Get-ToolVersion([string]$Cmd, [string[]]$VArgs) {
    try { [string](& $Cmd @VArgs 2>&1 | Select-Object -First 1) } catch { '' }
}

function Test-ComposeV2([string]$Mode) {
    if ($Mode -ne 'rig' -or -not (Get-Command docker -ErrorAction SilentlyContinue)) { return }
    $v = docker compose version --short 2>$null
    $ok = ($LASTEXITCODE -eq 0 -and $v)
    Add-Check 'Tools' 'docker compose' $(if ($ok) { 'PASS' } else { 'FAIL' }) $(if ($ok) { "v$v" } else { 'v2 plugin not found' }) 'update Docker Desktop (Compose v2 is bundled)'
}

function Test-GoVersion([string]$Mode) {
    if ($Mode -ne 'tunnel' -or -not (Get-Command go -ErrorAction SilentlyContinue)) { return }
    $m = [regex]::Match([string](go version), 'go(\d+\.\d+(?:\.\d+)?)')
    if (-not $m.Success) { return }
    $have = [version]$m.Groups[1].Value
    $ok = $have -ge [version]'1.26.9'
    Add-Check 'Tools' 'go version' $(if ($ok) { 'PASS' } else { 'WARN' }) "go$have" 'govulncheck listed standard-library fixes in 1.26.9; tunnel mode builds with this Go (winget upgrade GoLang.Go)'
}

function Test-Tools([string]$Mode) {
    foreach ($t in Get-ToolTable | Where-Object { $_.Modes -contains $Mode }) {
        if (-not (Get-Command $t.Cmd -ErrorAction SilentlyContinue)) {
            Add-Check 'Tools' $t.Name $(if ($t.Need) { 'FAIL' } else { 'WARN' }) 'not found on PATH' $t.Fix
            continue
        }
        Add-Check 'Tools' $t.Name 'PASS' (Get-ToolVersion $t.Cmd $t.VArgs) ''
    }
    Test-ComposeV2 $Mode
    Test-GoVersion $Mode
}