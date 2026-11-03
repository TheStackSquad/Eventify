# audit/runner/load-env.ps1

# 1. Set EVENTIFY_ENV_FILE using the correct relative path from audit/runner/
$env:EVENTIFY_ENV_FILE = (Resolve-Path (Join-Path $PSScriptRoot '../docker/.env')).Path

# 2. Source core env helpers
. (Join-Path $PSScriptRoot '../core/env.ps1')
$null = Import-AuditEnvFile (Join-Path $PSScriptRoot '../docker/.env')   # vendor logins, Paystack test key, FRONTEND_URL

# 3. Set test database overrides
$env:AUDIT_DB_URL = 'postgres://loadtest:loadtest@127.0.0.1:55432/eventify_loadtest?sslmode=disable'
$env:POSTGRES_URI = $env:AUDIT_DB_URL

# ============================================================================
# VERIFICATION & REDACTED DEBUG PRINTING
# ============================================================================
$vitalEnvs = @(
    "EVENTIFY_ENV_FILE",
    "PAYSTACK_SECRET_KEY",
    "POSTGRES_URI",
    "FRONTEND_URL"
)

Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "🔍 Verifying Environment Configuration:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

foreach ($envKey in $vitalEnvs) {
    $val = [Environment]::GetEnvironmentVariable($envKey)
    if ([string]::IsNullOrEmpty($val)) {
        Write-Host "❌ $envKey : MISSING / EMPTY" -ForegroundColor Red
    } else {
        $masked = $val
        # If it's a long secret or path, mask it nicely
        if ($envKey -eq "EVENTIFY_ENV_FILE" -or $envKey -eq "POSTGRES_URI" -or $envKey -eq "FRONTEND_URL") {
            $masked = $val # Safe to show paths/URLs
        } elseif ($val.Length -gt 4) {
            $masked = "****" + $val.Substring($val.Length - 4)
        }
        Write-Host "✅ $envKey : $masked" -ForegroundColor Green
    }
}
Write-Host "----------------------------------------" -ForegroundColor Cyan