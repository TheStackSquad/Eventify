# audit/core/lock.ps1

# core/lock.ps1 : one audit run at a time. The suites share the database, port 8081, the stub and the ngrok domain.
# The door takes the lock and hands a token to the orchestrators it starts, so a suite launched by the door never locks itself out.
$script:HeldLockToken = $null

function Get-LockPath { [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../results/.run.lock')) }

function Read-RunLock([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json } catch { return $null }
}

function Test-LockStale($Lock) {
    if (-not $Lock) { return $true }
    $age = (Get-Date).ToUniversalTime() - ([datetime]$Lock.started).ToUniversalTime()
    if ($age.TotalHours -gt 4) { return $true }
    return -not (Get-Process -Id ([int]$Lock.pid) -ErrorAction SilentlyContinue)
}

function Enter-RunLock {
    param([Parameter(Mandatory)][string]$Suite, [string]$Mode = '', [switch]$Force)
    $path = Get-LockPath
    $lock = Read-RunLock $path
    if ($lock -and $env:AUDIT_RUN_LOCK_TOKEN -and $lock.token -eq $env:AUDIT_RUN_LOCK_TOKEN) { return }   # inherited from the door
    if ($lock -and -not $Force -and -not (Test-LockStale $lock)) {
        throw ("Another audit run holds the lock: suite {0}, mode {1}, pid {2}, since {3}. Wait for it, or pass -Force if it is dead." -f $lock.suite, $lock.mode, $lock.pid, $lock.started)
    }
    if ($lock) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    $token = [guid]::NewGuid().ToString('N')
    $body = [ordered]@{ suite = $Suite; mode = $Mode; pid = $PID; token = $token; started = (Get-Date).ToUniversalTime().ToString('o') } | ConvertTo-Json
    try {
        $fs = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)   # CreateNew: atomic if two launchers race
        try { $bytes = [Text.Encoding]::UTF8.GetBytes($body); $fs.Write($bytes, 0, $bytes.Length) } finally { $fs.Dispose() }
    }
    catch [IO.IOException] { throw 'Another audit run took the lock a moment ago. Try again.' }
    $env:AUDIT_RUN_LOCK_TOKEN = $token
    $script:HeldLockToken = $token
}

function Exit-RunLock {
    if (-not $script:HeldLockToken) { return }
    $path = Get-LockPath
    $lock = Read-RunLock $path
    if ($lock -and $lock.token -eq $script:HeldLockToken) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue }
    $script:HeldLockToken = $null
    Remove-Item Env:\AUDIT_RUN_LOCK_TOKEN -ErrorAction SilentlyContinue
}