# audit/suites/auth/auth-helpers.ps1 : HTTP with response headers, accounts, sessions and forged tokens.

function Invoke-AuthHttp {
    param([string]$Method, [string]$Path, [string]$Jar = '', [hashtable]$Headers = @{}, [string]$Body = $null)
    $id  = [guid]::NewGuid().ToString('N')
    $out = Join-Path $Tmp "$id.out"
    $hdr = Join-Path $Tmp "$id.hdr"
    $curl = @('-s', '-S', '--max-time', '30', '-o', $out, '-D', $hdr, '-w', '%{http_code}', '-X', $Method)
    if ($Jar) { $curl += @('-b', $Jar, '-c', $Jar) }
    foreach ($k in $Headers.Keys) { $curl += @('-H', ('{0}: {1}' -f $k, $Headers[$k])) }
    if ($null -ne $Body) {
        $bodyFile = Join-Path $Tmp "$id.body"
        [IO.File]::WriteAllText($bodyFile, $Body, (New-Object Text.UTF8Encoding $false))
        $curl += @('-H', 'Content-Type: application/json', '--data-binary', "@$bodyFile")
    }
    $code = & curl.exe @curl ($BaseUrl + $Path)
    $text = ''; if (Test-Path -LiteralPath $out) { $text = [IO.File]::ReadAllText($out) }
    $head = ''; if (Test-Path -LiteralPath $hdr) { $head = [IO.File]::ReadAllText($hdr) }
    $json = $null; try { if ($text) { $json = $text | ConvertFrom-Json } } catch { $json = $null }
    $cookies = @([regex]::Matches($head, '(?im)^set-cookie:\s*(.+?)\r?$') | ForEach-Object { $_.Groups[1].Value.Trim() })
    [pscustomobject]@{ Status = [int]$code; Body = $text; Json = $json; Head = $head; SetCookies = $cookies }
}

function Get-HeaderValue($Resp, [string]$Name) {
    $m = [regex]::Match($Resp.Head, ('(?im)^' + [regex]::Escape($Name) + ':\s*(.+?)\r?$'))
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

function Get-CookieAttr($Resp, [string]$Name) {
    $line = @($Resp.SetCookies | Where-Object { $_ -like "$Name=*" }) | Select-Object -Last 1
    if (-not $line) { return $null }
    $age = [regex]::Match($line, '(?i);\s*Max-Age=(-?\d+)')
    [pscustomobject]@{
        Raw      = $line
        HttpOnly = ($line -match '(?i);\s*HttpOnly')
        Secure   = ($line -match '(?i);\s*Secure')
        SameSite = [regex]::Match($line, '(?i);\s*SameSite=(\w+)').Groups[1].Value
        MaxAge   = $(if ($age.Success) { [int]$age.Groups[1].Value } else { $null })
    }
}

function Format-CookieFlags($Attr) {
    if (-not $Attr) { return 'missing' }
    return "HttpOnly=$($Attr.HttpOnly) SameSite=$($Attr.SameSite)"
}

function New-AuthUser([string]$Tag = 'user', [hashtable]$Extra = @{}, [string]$Email = '', [string]$Password = '') {
    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
    if (-not $Email) { $Email = "audit_auth_${Tag}_$suffix@example.com" }
    if (-not $Password) { $Password = "Audit-$suffix-Aa1" }
    $body = @{ name = "Audit Auth $Tag"; email = $Email; password = $Password }
    foreach ($k in $Extra.Keys) { $body[$k] = $Extra[$k] }
    $r = Invoke-AuthHttp -Method POST -Path '/auth/signup' -Body ($body | ConvertTo-Json -Compress)
    [pscustomobject]@{ Email = $Email; Password = $Password; Status = $r.Status; Body = $r.Body }
}

function Invoke-AuthLogin($User, [string]$Jar, [bool]$Remember = $false) {
    $b = @{ email = $User.Email; password = $User.Password; rememberMe = $Remember } | ConvertTo-Json -Compress
    Invoke-AuthHttp -Method POST -Path '/auth/login' -Jar $Jar -Body $b
}

# A fresh login in its own cookie jar, so a test that ends the session cannot disturb the next one.
function New-AuthSession([string]$Label) {
    $jar = Join-Path $Tmp ("$Label-" + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.jar')
    $r = Invoke-AuthLogin $Ctx.User $jar
    [pscustomobject]@{
        Jar = $jar; Resp = $r
        Access  = (Get-CookieValue $jar 'access_token')
        Refresh = (Get-CookieValue $jar 'refresh_token')
        Csrf    = (Get-CookieValue $jar 'csrf_token')
    }
}

function ConvertTo-B64Url([byte[]]$Bytes) { [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_') }
function ConvertFrom-B64Url([string]$Text) {
    $t = $Text.Replace('-', '+').Replace('_', '/')
    switch ($t.Length % 4) { 2 { $t += '==' } 3 { $t += '=' } }
    [Convert]::FromBase64String($t)
}

# Three forgeries of a real access token. A character in the middle of the signature is changed, because the last
# character of a base64 signature carries padding bits that a decoder may ignore.
function New-ForgedTokens([string]$Token) {
    $p = $Token.Split('.')
    $noneHeader = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes('{"alg":"none","typ":"JWT"}'))
    $chars = $p[2].ToCharArray()
    $chars[10] = $(if ($chars[10] -eq 'A') { 'B' } else { 'A' })
    $payload = [Text.Encoding]::UTF8.GetString((ConvertFrom-B64Url $p[1])) -replace '"user_id":"[^"]*"', ('"user_id":"' + [guid]::NewGuid() + '"')
    $swapped = ConvertTo-B64Url ([Text.Encoding]::UTF8.GetBytes($payload))
    [ordered]@{
        'unsigned (alg none)'            = ($noneHeader + '.' + $p[1] + '.')
        'one signature character changed' = ($p[0] + '.' + $p[1] + '.' + (-join $chars))
        'another user id, old signature' = ($p[0] + '.' + $swapped + '.' + $p[2])
    }
}

function Confirm-AuthTables {
    foreach ($t in 'users', 'refresh_tokens', 'token_blacklist', 'login_attempts') {
        try { $null = Invoke-Sql "SELECT 1 FROM $t LIMIT 1" } catch { Stop-Setup "cannot query $t. Is the rig database up and migrated? ($($_.Exception.Message))" }
    }
}

function Clear-AuthAccounts {
    if ($env:AUDIT_DB_URL -notmatch '@(localhost|127\.0\.0\.1)[:/]') { throw 'AUDIT_DB_URL must point at localhost' }
    $null = Invoke-Sql "DELETE FROM login_attempts WHERE starts_with(lower(email), 'audit_auth_'); DELETE FROM users WHERE starts_with(lower(email), 'audit_auth_') AND lower(email) LIKE '%@example.com'"
}

function Test-AuthBackendUp {
    $r = Invoke-Http -Method GET -Url "$BaseUrl/health"
    Check 'AUTH-B1' 'the backend answers on /health' '200' "$($r.Status)" ($r.Status -eq 200)
    if ($r.Status -ne 200) { Stop-Setup "the backend is not answering at $BaseUrl (HTTP $($r.Status))" }
}

# A crash in one group is recorded and the next group still runs.
function Invoke-AuthGroup([string]$Name, [scriptblock]$Body) {
    Write-Host "[Group] $Name" -ForegroundColor Cyan
    try { & $Body }
    catch { Add-Result 'AUTH-X' "$Name crashed" 'the group runs to the end' $_.Exception.Message 'FAIL' 'a crash, not a failed assertion: read the message' }
}
