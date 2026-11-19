# audit/runner/probe-vendor-verification.ps1
<#
.SYNOPSIS
  Probes the vendor verification rules against a running rig backend.
.DESCRIPTION
  Needs the rig backend running with VERIFICATION_PROOF_SECRET and ALLOW_SANDBOX_VERIFICATION=true
  (docker-compose.loadtest.yml sets both) and VERIFICATION_PROOF_SECRET in audit\docker\.env.
  Creates one throwaway account and vendor (audit_probe_*@example.com) per run.
  Writes audit\results\vendor-verification-<time>.json. Exit code 1 when a check fails.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File audit\runner\probe-vendor-verification.ps1
#>
param(
    [string]$BaseUrl = 'http://localhost:8081',
    [string]$CsrfCookie = 'csrf_token',
    [string]$CsrfHeader = 'X-CSRF-Token'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\core\config.ps1')
. (Join-Path $PSScriptRoot '..\core\proof.ps1')
Initialize-AuditConfig 'rig' | Out-Null

$script:Results = New-Object System.Collections.Generic.List[object]
$script:Temp = New-Object System.Collections.Generic.List[string]

function Send([string]$Method, [string]$Path, $Object, [string]$Jar, [string]$Csrf) {
    $out = [IO.Path]::GetTempFileName()
    $inp = $null
    $curl = @('-s', '-o', $out, '-w', '%{http_code}', '-X', $Method, '-H', 'Content-Type: application/json', '-b', $Jar, '-c', $Jar)
    if ($Csrf) { $curl += @('-H', ('{0}: {1}' -f $CsrfHeader, $Csrf)) }
    if ($null -ne $Object) {
        $inp = [IO.Path]::GetTempFileName()
        [IO.File]::WriteAllText($inp, ($Object | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
        $curl += @('--data-binary', "@$inp")
    }
    $code = (& curl.exe @curl "$BaseUrl$Path") -join ''
    $body = [IO.File]::ReadAllText($out)
    @($out, $inp) | Where-Object { $_ } | ForEach-Object { Remove-Item $_ -ErrorAction SilentlyContinue }
    $json = $null
    try { if ($body) { $json = $body | ConvertFrom-Json } } catch { }
    [pscustomobject]@{ Code = [int]$code; Body = $body; Json = $json }
}

function Get-Csrf([string]$Jar) {
    foreach ($line in Get-Content -LiteralPath $Jar) {
        $f = ($line -replace '^#HttpOnly_', '') -split "`t"
        if ($f.Count -ge 7 -and $f[5] -eq $CsrfCookie) { return $f[6] }
    }
    return $null
}

function New-Jar { $j = [IO.Path]::GetTempFileName(); $script:Temp.Add($j); $j }

function New-Session([string]$Email, [string]$Password) {
    $jar = New-Jar
    $r = Send 'POST' '/auth/login' @{ email = $Email; password = $Password } $jar $null
    if ($r.Code -ne 200) { throw "login failed for $Email (HTTP $($r.Code)): $($r.Body)" }
    [pscustomobject]@{ Jar = $jar; Csrf = (Get-Csrf $jar); Email = $Email }
}

function Get-UserId([string]$Email) {
    $sql = "SELECT id FROM users WHERE lower(email) = lower('{0}')" -f $Email.Replace("'", "''")
    $id = ((& psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -t -A -q -c $sql) -join '').Trim()
    if ($id -notmatch '^[0-9a-fA-F-]{36}$') { throw "Could not find the user id for $Email" }
    return $id
}

function Check([string]$Id, [string]$Name, $Expected, $Actual, [bool]$Ok) {
    $outcome = if ($Ok) { 'PASS' } else { 'FAIL' }
    $script:Results.Add([pscustomobject]@{ Id = $Id; Name = $Name; Expected = "$Expected"; Actual = "$Actual"; Outcome = $outcome })
    $color = if ($Ok) { 'Green' } else { 'Red' }
    Write-Host ('[{0}] {1} {2}  (expected: {3} | got: {4})' -f $outcome, $Id, $Name, $Expected, $Actual) -ForegroundColor $color
}

function Expect-Code([string]$Id, [string]$Name, $Response, [int[]]$Want) {
    Check $Id $Name ($Want -join ' or ') $Response.Code ($Want -contains $Response.Code)
}

function New-Body([hashtable]$Over = @{}) {
    $b = @{
        name = 'Probe Vendor'; category = 'Catering'; state = 'Lagos'; city = 'Ikeja'
        description = 'Automated probe vendor'; phone_number = '08099990000'
        image_url = 'https://example.com/probe.jpg'; min_price = 50000
        first_name = 'Typed'; last_name = 'ByUser'
    }
    foreach ($k in $Over.Keys) { $b[$k] = $Over[$k] }
    return $b
}

$userId = $null
try {
    # ── Accounts: one throwaway user, plus audit vendor 1 as "somebody else" ──────────────────
    $stamp = [guid]::NewGuid().ToString('N').Substring(0, 10)
    $email = "audit_probe_$stamp@example.com"
    $password = 'Aa1!' + [guid]::NewGuid().ToString('N')
    $signupJar = New-Jar
    $su = Send 'POST' '/auth/signup' @{ name = 'Probe Tester'; email = $email; password = $password } $signupJar $null
    if ($su.Code -lt 200 -or $su.Code -ge 300) { throw "signup failed (HTTP $($su.Code)): $($su.Body)" }
    $a = New-Session $email $password
    $userId = Get-UserId $email
    $other = New-Session $env:AUDIT_VENDOR_EMAIL $env:AUDIT_VENDOR_PASSWORD
    $otherId = Get-UserId $env:AUDIT_VENDOR_EMAIL

    $vnin = @{ fn = 'Probe'; mn = ''; ln = 'Tester'; l4 = '12CD' }
    $goodVnin = New-VerificationProof -Kind vnin -UserId $userId -Claims $vnin
    $goodCac  = New-VerificationProof -Kind cac -UserId $userId -Claims @{ rc = 'RC1234567'; cn = 'PROBE FOODS LIMITED'; om = $true; rl = @('director') }
    $tail = if ($goodVnin.EndsWith('AA')) { 'BB' } else { 'AA' }
    $forged = $goodVnin.Substring(0, $goodVnin.Length - 2) + $tail
    $register = '/api/v1/vendors/register'

    Write-Host '=== Registration is refused without a valid proof ===' -ForegroundColor Cyan
    Expect-Code 'VER-1' 'no proof' (Send 'POST' $register (New-Body) $a.Jar $a.Csrf) 400
    Expect-Code 'VER-2' 'forged signature' (Send 'POST' $register (New-Body @{ vnin_proof = $forged }) $a.Jar $a.Csrf) 403
    $theirs = New-VerificationProof -Kind vnin -UserId $otherId -Claims $vnin
    Expect-Code 'VER-3' "another user's proof" (Send 'POST' $register (New-Body @{ vnin_proof = $theirs }) $a.Jar $a.Csrf) 403
    $expired = New-VerificationProof -Kind vnin -UserId $userId -Claims $vnin -TtlSeconds -120
    Expect-Code 'VER-4' 'expired proof' (Send 'POST' $register (New-Body @{ vnin_proof = $expired }) $a.Jar $a.Csrf) 403
    Expect-Code 'VER-5' 'self-declared flags without a proof' (Send 'POST' $register (New-Body @{
        is_identity_verified = $true; is_business_verified = $true; vnin = 'AB123456789012CD'; verified_vnin = 'AB123456789012CD'
    }) $a.Jar $a.Csrf) 400
    Expect-Code 'VER-6' 'CAC proof without an identity proof' (Send 'POST' $register (New-Body @{ cac_proof = $goodCac }) $a.Jar $a.Csrf) 400
    $notOwner = New-VerificationProof -Kind cac -UserId $userId -Claims @{ rc = 'RC1234567'; cn = 'PROBE FOODS LIMITED'; om = $false }
    Expect-Code 'VER-7' 'CAC proof where the owner did not match' (Send 'POST' $register (New-Body @{ vnin_proof = $goodVnin; cac_proof = $notOwner }) $a.Jar $a.Csrf) 403

    Write-Host '=== A valid registration: the proofs decide, not the body ===' -ForegroundColor Cyan
    $reg = Send 'POST' $register (New-Body @{
        vnin_proof = $goodVnin; cac_proof = $goodCac
        is_identity_verified = $false; vnin = 'AB123456789012CD'   # ignored on purpose
    }) $a.Jar $a.Csrf
    Expect-Code 'VER-8' 'registration with both proofs' $reg 201

    $me = Send 'GET' '/api/v1/vendors/me' $null $a.Jar $null
    Expect-Code 'VER-9' 'owner can read /vendors/me' $me 200
    $m = $me.Json
    if ($m) {
        Check 'VER-10' 'identity verified from the proof' 'true' $m.isIdentityVerified ($m.isIdentityVerified -eq $true)
        Check 'VER-11' 'names come from the proof, not the form' 'Probe Tester' "$($m.firstName) $($m.lastName)" (($m.firstName -eq 'Probe') -and ($m.lastName -eq 'Tester'))
        Check 'VER-12' 'only the last 4 of the vNIN is exposed' '12CD' $m.vninLast4 ($m.vninLast4 -eq '12CD')
        Check 'VER-13' 'business verified, CAC saved, name overridden' 'PROBE FOODS LIMITED / RC1234567' "$($m.name) / $($m.cacNumber)" (($m.isBusinessVerified -eq $true) -and ($m.name -eq 'PROBE FOODS LIMITED') -and ($m.cacNumber -eq 'RC1234567'))
        Check 'VER-14' 'CAC badge flag is set' 'true' $m.isBusinessRegistered ($m.isBusinessRegistered -eq $true)
    }
    $vendorId = if ($m) { $m.id } else { $null }

    if ($vendorId) {
        Write-Host '=== Updates cannot undo verification or touch moderation ===' -ForegroundColor Cyan
        $other1 = New-VerificationProof -Kind vnin -UserId $userId -Claims @{ fn = 'Hacker'; mn = ''; ln = 'Other'; l4 = '9999' }
        $patch = Send 'PATCH' "/api/v1/vendors/$vendorId" (New-Body @{
            first_name = 'Hacker'; last_name = 'Other'; name = 'Renamed Co'; vnin_proof = $other1
            status = 'suspended'; is_identity_verified = $false; is_business_verified = $false
        }) $a.Jar $a.Csrf
        Expect-Code 'VER-15' 'owner update is accepted' $patch 200
        $m2 = (Send 'GET' '/api/v1/vendors/me' $null $a.Jar $null).Json
        if ($m2) {
            Check 'VER-16' 'verified names and business name are immutable' 'Probe Tester / PROBE FOODS LIMITED' "$($m2.firstName) $($m2.lastName) / $($m2.name)" (($m2.firstName -eq 'Probe') -and ($m2.lastName -eq 'Tester') -and ($m2.name -eq 'PROBE FOODS LIMITED'))
            Check 'VER-17' 'flags stay verified' 'true / true' "$($m2.isIdentityVerified) / $($m2.isBusinessVerified)" (($m2.isIdentityVerified -eq $true) -and ($m2.isBusinessVerified -eq $true))
            Check 'VER-18' 'owner cannot change moderation status' 'active' $m2.status ($m2.status -eq 'active')
        }
        Expect-Code 'VER-19' "someone else's vendor cannot be edited" (Send 'PATCH' "/api/v1/vendors/$vendorId" (New-Body @{ vnin_proof = $goodVnin }) $other.Jar $other.Csrf) 403
    }

    Write-Host '=== Reads and contact details ===' -ForegroundColor Cyan
    $anon = New-Jar
    Expect-Code 'VER-20' '/vendors/me needs a session' (Send 'GET' '/api/v1/vendors/me' $null $anon $null) 401
    if ($vendorId) {
        Expect-Code 'VER-21' '/contact needs a session' (Send 'GET' "/api/v1/vendors/$vendorId/contact" $null $anon $null) 401

        $first = Send 'GET' "/api/v1/vendors/$vendorId/contact" $null $a.Jar $null
        Check 'VER-22' 'a signed-in user can reveal the number' '200 + 08099990000' "$($first.Code) $($first.Json.phoneNumber)" (($first.Code -eq 200) -and ($first.Json.phoneNumber -eq '08099990000'))
        $codes = @($first.Code)
        2..25 | ForEach-Object { $codes += (Send 'GET' "/api/v1/vendors/$vendorId/contact" $null $a.Jar $null).Code }
        $served = @($codes | Where-Object { $_ -eq 200 }).Count
        Check 'VER-23' 'reveals are rate limited (max 20 per hour)' '429 seen, <= 20 served' "$served served, 429 seen: $($codes -contains 429)" (($codes -contains 429) -and ($served -le 20))
    }

    Write-Host '=== Public responses carry no personal data ===' -ForegroundColor Cyan
    $list = Send 'GET' '/api/v1/vendors?limit=50' $null $anon $null
    Check 'VER-24' 'public list has no phoneNumber, email or vnin' 'none of the three' $(if ($list.Body -match '"phoneNumber"|"email"|"vnin"') { 'found one' } else { 'none' }) ($list.Body -notmatch '"phoneNumber"|"email"|"vnin"')
    if ($vendorId) {
        $detail = Send 'GET' "/api/v1/vendors/$vendorId" $null $anon $null
        Check 'VER-25' 'public detail: hasPhone true, no phoneNumber, no vnin' 'hasPhone only' $(if ($detail.Body -match '"hasPhone":true') { 'hasPhone true' } else { 'hasPhone missing' }) (($detail.Body -match '"hasPhone":true') -and ($detail.Body -notmatch '"phoneNumber"|"vnin"'))
    }
}
finally {
    $script:Temp | ForEach-Object { Remove-Item $_ -ErrorAction SilentlyContinue }
    if ($userId) {
        $sql = "DELETE FROM vendors WHERE owner_id = '$userId'; DELETE FROM users WHERE id = '$userId';"
        try { & psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q -c $sql 2>$null | Out-Null } catch { }
        if ($LASTEXITCODE -ne 0) { Write-Host "  note: the probe account $email was left in the rig database (a foreign key blocked cleanup)." -ForegroundColor DarkGray }
    }
}

$failed = @($script:Results | Where-Object { $_.Outcome -eq 'FAIL' }).Count
$stampOut = Get-Date -Format 'yyyyMMdd-HHmmss'
$outFile = Join-Path $PSScriptRoot "..\results\vendor-verification-$stampOut.json"
$script:Results | ConvertTo-Json | Set-Content -LiteralPath $outFile -Encoding UTF8
Write-Host ("`nSummary: {0} passed, {1} failed. Results: {2}" -f ($script:Results.Count - $failed), $failed, $outFile) -ForegroundColor Cyan
exit $(if ($failed -gt 0) { 1 } else { 0 })