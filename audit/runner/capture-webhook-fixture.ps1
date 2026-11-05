# audit/runner/capture-webhook-fixture.ps1

# Saves the newest REAL Paystack webhook body byte-for-byte, redacting only secrets.
param([string]$Out = 'audit/fixtures/paystack/charge.success.real.json')
$cap = Invoke-RestMethod -Uri 'http://127.0.0.1:4040/api/requests/http?limit=100' -TimeoutSec 3
$real = @($cap.requests | Where-Object { $_.request.uri -like '*/api/webhooks/paystack*' -and ([string]$_.request.headers.'User-Agent') -match 'Paystack' }) | Select-Object -First 1
if (-not $real) { throw 'No real Paystack webhook in the inspector. Pay once with a test card while ngrok runs, then run this again.' }
$raw = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($real.request.raw))
$body = $raw.Substring($raw.IndexOf("`r`n`r`n") + 4)
$body = $body -replace '("authorization_code"\s*:\s*")[^"]*', '${1}AUTH_redacted' -replace '("signature"\s*:\s*")[^"]*', '${1}SIG_redacted' -replace '("ip_address"\s*:\s*")[^"]*', '${1}203.0.113.1'
$path = Join-Path (Get-Location).Path $Out
New-Item -ItemType Directory -Force (Split-Path $path) | Out-Null
[IO.File]::WriteAllText($path, $body, (New-Object Text.UTF8Encoding $false))
"saved $path ($($body.Length) bytes). Dates keep their .000Z: " + ($body -match '"paid_at":\s*"[^"]*\.000Z"')