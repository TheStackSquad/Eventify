# audit/core/proof.ps1 : mints SANDBOX verification proofs for the rig.
# Same format as frontend/src/utils/server/verificationProof.js. Only a backend started with
# ALLOW_SANDBOX_VERIFICATION=true accepts them, so they are useless against a real deployment.

function ConvertTo-Base64Url([byte[]]$Bytes) {
    [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function New-VerificationProof {
    param(
        [Parameter(Mandatory)][ValidateSet('vnin', 'cac')][string]$Kind,
        [Parameter(Mandatory)][string]$UserId,
        [hashtable]$Claims = @{},
        [int]$TtlSeconds = 7200
    )
    $secret = [Environment]::GetEnvironmentVariable('VERIFICATION_PROOF_SECRET', 'Process')
    if (-not $secret -or $secret.Length -lt 32) {
        throw 'VERIFICATION_PROOF_SECRET is not set (32+ characters). Add it to audit\docker\.env (openssl rand -hex 32).'
    }
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $payload = [ordered]@{ v = 1; kind = $Kind; uid = $UserId }
    foreach ($k in $Claims.Keys) { $payload[$k] = $Claims[$k] }
    $payload['env'] = 'sandbox'
    $payload['iat'] = $now
    $payload['exp'] = $now + $TtlSeconds

    $body = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress)))
    $hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
    $sig  = ConvertTo-Base64Url ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)))
    return "$body.$sig"
}