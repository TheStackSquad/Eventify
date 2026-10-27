# audit/core/env.ps1

# core/env.ps1 : minimal env loading. Phase P2 replaces this with a schema-driven loader.
$script:EnvPrefixes = '^(AUDIT|PAYSTACK|POSTGRES|STUB|FRONTEND|SMTP|FROM|NGROK|RSA_|BASE_|WEBHOOK_)'

function Import-AuditEnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Env file not found: $Path" }
    $count = 0
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$') {
            $name = $Matches[1]; $value = $Matches[2].Trim('"', "'")
            if ($name -match $script:EnvPrefixes -and $value) {
                [Environment]::SetEnvironmentVariable($name, $value, 'Process'); $count++
            }
        }
    }
    return $count
}

function Get-Setting([string]$Name) { [Environment]::GetEnvironmentVariable($Name, 'Process') }