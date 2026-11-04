# core/config.ps1 : the one place that reads the audit settings, checks them and hands them to child processes.
# The file wins over anything already set in the shell, so a stale terminal value can never beat it.

function Get-Setting([string]$Name) { [Environment]::GetEnvironmentVariable($Name, 'Process') }

$script:Validators = @{
    sk_test  = { param($v) $v -match '^sk_test_[A-Za-z0-9]{10,}$' }
    pk_test  = { param($v) $v -match '^pk_test_[A-Za-z0-9]{10,}$' }
    rigdb    = { param($v) ($v -match '@(localhost|127\.0\.0\.1)[:/]') -and ($v -match '/[^/?]*(loadtest|audit|test)[^/?]*(\?|$)') }
    url      = { param($v) $v -match '^https?://\S+$' }
    port     = { param($v) ($v -match '^\d{2,5}$') -and ([int]$v -le 65535) }
    domain   = { param($v) $v -match '^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' }
    email    = { param($v) $v -match '^[^@\s]+@[^@\s]+\.[^@\s]+$' }
    duration = { param($v) $v -match '^\d+(ms|s|m|h)$' }
}

function New-Result($Name, $Status, $Detail, $Fix) { [pscustomobject]@{ Name = $Name; Status = $Status; Detail = $Detail; Fix = $Fix } }

function Read-EnvFile([string]$Path) {
    $map = [ordered]@{}
    $lines = @(Get-Content -LiteralPath $Path)
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name = $Matches[1]; $value = $Matches[2].Trim()
            if ($value.StartsWith('"') -and -not ($value.Length -gt 1 -and $value.EndsWith('"'))) {
                while ($i + 1 -lt $lines.Count) {      # a quoted value that continues on the next lines, such as a PEM key
                    $i++; $value += "`n" + $lines[$i]
                    if ($lines[$i].TrimEnd().EndsWith('"')) { break }
                }
            }
            $map[$name] = $value.Trim('"', "'")
        }
    }
    return $map
}

function Get-Fingerprint([string]$Value) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    $hex = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)) | ForEach-Object { $_.ToString('x2') })
    return 'sha256:' + $hex.Substring(0, 8)
}

function Get-ConfigDetail($Var, [string]$Value, [string]$Source) {
    if ($Var.Name -eq 'AUDIT_DB_URL' -and $Value -match '@([^/]+)/([^?]+)') { return ('{0}/{1}' -f $Matches[1], $Matches[2]) }
    if ($Var.Secret) { return ('{0} ({1})' -f (Get-Fingerprint $Value), $Source) }
    return ('{0} ({1})' -f $Value, $Source)
}

function Import-AuditConfig {
    param([ValidateSet('rig', 'tunnel')][string]$Mode = 'tunnel', [string]$EnvFile = '')
    $root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    if (-not $EnvFile) { $EnvFile = Join-Path $root 'audit\docker\.env' }
    if (-not (Test-Path -LiteralPath $EnvFile)) { throw "Config file not found: $EnvFile. Copy audit\docker\.env.example to audit\docker\.env and fill it in." }
    $schema = (Import-PowerShellDataFile (Join-Path $PSScriptRoot '..\config\env.schema.psd1')).Vars
    $file = Read-EnvFile $EnvFile
    $values = @{}
    $results = New-Object System.Collections.Generic.List[object]

    foreach ($v in $schema) {
        if ($v.ContainsKey('Load') -and -not $v.Load) { continue }
        $value = ''; $source = 'missing'
        if ($file.Contains($v.Name) -and $file[$v.Name]) { $value = $file[$v.Name]; $source = 'file' }
        elseif ($v.ContainsKey('Default')) { $value = $v.Default; $source = 'default' }

        $needed = @($v.Need) -contains $Mode
        $fix = if ($v.ContainsKey('Fix')) { $v.Fix } else { '' }
        if (-not $value) {
            $status = if (-not $needed) { 'SKIP' } elseif ($v.ContainsKey('Warn') -and $v.Warn) { 'WARN' } else { 'FAIL' }
            $results.Add((New-Result $v.Name $status 'not set' $fix))
            continue
        }
        $check = if ($v.ContainsKey('Check')) { $v.Check } else { '' }
        if ($check -and -not (& $script:Validators[$check] $value)) {
            $results.Add((New-Result $v.Name 'FAIL' 'has the wrong shape' $fix))
        }
        else {
            $detail = Get-ConfigDetail $v $value $source
            $shell = Get-Setting $v.Name
            if ($shell -and $shell -ne $value) { $detail += ' - a different shell value was overridden' }
            $results.Add((New-Result $v.Name 'PASS' $detail ''))
        }
        [Environment]::SetEnvironmentVariable($v.Name, $value, 'Process')
        $values[$v.Name] = $value
    }

    $known = @($schema | ForEach-Object { $_.Name })
    foreach ($name in $file.Keys) {
        if ($known -notcontains $name) { $results.Add((New-Result $name 'WARN' 'not in the schema (typo?)' 'add it to audit\config\env.schema.psd1 or remove it')) }
    }

    if (-not $values.ContainsKey('FRONTEND_BASE_URL') -and $values.ContainsKey('FRONTEND_URL')) {
        $values['FRONTEND_BASE_URL'] = $values['FRONTEND_URL']
        [Environment]::SetEnvironmentVariable('FRONTEND_BASE_URL', $values['FRONTEND_URL'], 'Process')
    }
    if ($values.ContainsKey('AUDIT_DB_URL')) { [Environment]::SetEnvironmentVariable('POSTGRES_URI', $values['AUDIT_DB_URL'], 'Process') }
    [Environment]::SetEnvironmentVariable('EVENTIFY_ENV_FILE', $EnvFile, 'Process')   # the backend reads this file itself
    return [pscustomobject]@{ Mode = $Mode; File = $EnvFile; Results = $results; Values = $values }
}

# Loads the settings and stops with a readable list if any is missing or malformed.
function Initialize-AuditConfig([string]$Mode = 'tunnel', [string]$EnvFile = '') {
    $cfg = Import-AuditConfig -Mode $Mode -EnvFile $EnvFile
    $bad = @($cfg.Results | Where-Object { $_.Status -eq 'FAIL' })
    if ($bad.Count) {
        foreach ($b in $bad) { Write-Host ('  {0}: {1}. {2}' -f $b.Name, $b.Detail, $b.Fix) -ForegroundColor Red }
        throw "The audit configuration is not valid ($($bad.Count) problem(s) above). Run run-matrix.ps1 -ShowConfig for the full picture."
    }
    return $cfg
}

function Show-AuditConfig($Cfg) {
    $color = @{ PASS = 'Green'; WARN = 'Yellow'; FAIL = 'Red'; SKIP = 'DarkGray' }
    Write-Host ("Config file: {0}   mode: {1}`n" -f $Cfg.File, $Cfg.Mode) -ForegroundColor Cyan
    foreach ($r in $Cfg.Results) { Write-Host ('  {0,-5} {1,-30} {2}' -f $r.Status, $r.Name, $r.Detail) -ForegroundColor $color[$r.Status] }
}