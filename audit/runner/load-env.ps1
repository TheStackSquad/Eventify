# audit/ runner/load-env.ps1

. (Join-Path $PSScriptRoot '../core/env.ps1')
$null = Import-AuditEnvFile (Join-Path $PSScriptRoot '../docker/.env')   # vendor logins, Paystack test key, FRONTEND_URL
$env:AUDIT_DB_URL = 'postgres://loadtest:loadtest@127.0.0.1:55432/eventify_loadtest?sslmode=disable'   # throwaway local rig database
$env:POSTGRES_URI = $env:AUDIT_DB_URL