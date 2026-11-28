# audit/suites/auth/checks-refresh.ps1 : refresh-token races, reuse, expiry and session lifetime (AUTH-T8 to AUTH-T12).
# The expiry and lifetime checks move rows back in time in the database, because waiting 30 days is not possible.

function Get-SetCookieValue($Resp, [string]$Name) {
    $line = @($Resp.SetCookies | Where-Object { $_ -like "$Name=*" }) | Select-Object -Last 1
    if (-not $line) { return $null }
    return (($line -split ';', 2)[0]).Substring($Name.Length + 1)
}

function Get-TokenSha([string]$Token) {
    $bytes = [Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($Token))
    return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

function Test-AuthRefresh {
    # AUTH-T8 (F404): ten refreshes at once with one token. Three rounds, because a race can be missed.
    $worst = 0; $notes = @()
    for ($round = 1; $round -le 3; $round++) {
        $s = New-AuthSession "race$round"
        $tok = $s.Refresh
        $res = @(1..10 | ForEach-Object -Parallel {
            $id  = [guid]::NewGuid().ToString('N')
            $hdr = Join-Path $using:Tmp "race-$id.hdr"
            $out = Join-Path $using:Tmp "race-$id.out"
            $code = & curl.exe -s -S --max-time 30 -o $out -D $hdr -w '%{http_code}' -X POST -H "Cookie: refresh_token=$($using:tok)" ($using:BaseUrl + '/auth/refresh')
            $head = ''; if (Test-Path -LiteralPath $hdr) { $head = [IO.File]::ReadAllText($hdr) }
            $m = [regex]::Match($head, '(?im)^set-cookie:\s*refresh_token=([^;\r\n]*)')
            $nr = ''; if ($m.Success) { $nr = $m.Groups[1].Value }
            [pscustomobject]@{ Status = [int]$code; NewRefresh = $nr }
        } -ThrottleLimit 10)
        $ok = @($res | Where-Object { $_.Status -eq 200 })
        $distinct = @($ok | ForEach-Object { $_.NewRefresh } | Where-Object { $_ } | Sort-Object -Unique).Count
        if ($distinct -gt $worst) { $worst = $distinct }
        $notes += "round ${round}: $($ok.Count) of 10 answered 200, $distinct different new refresh tokens"
    }
    Check 'AUTH-T8' 'ten refreshes at once with one token do not split the session' 'at most 1 new refresh token per round' ($notes -join '; ') ($worst -le 1)

    # AUTH-T9 (F405): a refresh token past its stored expiry
    $e = New-AuthSession 'expiry'
    $eh = Get-TokenSha $e.Refresh
    $null = Invoke-Sql ("UPDATE refresh_tokens SET expires_at = now() - interval '1 hour' WHERE token_hash = {0}" -f (Get-SqlLiteral $eh))
    $rows = Invoke-Sql ("SELECT count(*) FROM refresh_tokens WHERE token_hash = {0}" -f (Get-SqlLiteral $eh))
    $er = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$($e.Refresh)" }
    Check 'AUTH-T9' 'a refresh token past its stored expiry is refused' '401' "HTTP $($er.Status) (token row found: $rows)" (($rows -eq '1') -and ($er.Status -eq 401))

    # AUTH-T10 (F406): the 30-day limit counts from the first login of the session
    $a = New-AuthSession 'absolute'
    $first = $a.Refresh
    $r1 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Jar $a.Jar
    $second = Get-CookieValue $a.Jar 'refresh_token'
    $null = Invoke-Sql ("UPDATE refresh_tokens SET created_at = now() - interval '31 days' WHERE token_hash = {0}" -f (Get-SqlLiteral (Get-TokenSha $first)))
    # once the migration adds session_started_at, the limit counts from the session start: move that back for the whole chain
    $hasStart = [int](Invoke-Sql "SELECT count(*) FROM information_schema.columns WHERE table_name = 'refresh_tokens' AND column_name = 'session_started_at'")
    if ($hasStart -gt 0) { $null = Invoke-Sql ("UPDATE refresh_tokens SET session_started_at = now() - interval '31 days' WHERE token_hash IN ({0}, {1})" -f (Get-SqlLiteral (Get-TokenSha $first)), (Get-SqlLiteral (Get-TokenSha $second))) }
    $r2 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$second" }
    Check 'AUTH-T10' 'a session that began more than 30 days ago cannot be refreshed' '401' "first refresh $($r1.Status), refresh 31 days into the session: $($r2.Status)" (($r1.Status -eq 200) -and ($second -ne $first) -and ($r2.Status -eq 401))

    # AUTH-T11: reuse detection
    $u = New-AuthSession 'reuse'
    $old = $u.Refresh
    $u1 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Jar $u.Jar
    $newer = Get-CookieValue $u.Jar 'refresh_token'
    $null = Invoke-Sql ("UPDATE refresh_tokens SET consumed_at = now() - interval '2 minutes' WHERE token_hash = {0}" -f (Get-SqlLiteral (Get-TokenSha $old)))
    $reuse = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$old" }
    $child = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$newer" }
    Check 'AUTH-T11' 'reusing an old refresh token ends the whole session' '403 SECURITY_VIOLATION, then the newer token is dead (401)' "rotation $($u1.Status), reuse $($reuse.Status) $(Get-Prop $reuse.Json 'code'), newer token $($child.Status)" (($u1.Status -eq 200) -and ($reuse.Status -eq 403) -and ((Get-Prop $reuse.Json 'code') -eq 'SECURITY_VIOLATION') -and ($child.Status -eq 401))

    # AUTH-T12: the same old token twice in a row, inside the grace window
    $g = New-AuthSession 'grace'
    $gold = $g.Refresh
    $g1 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$gold" }
    $g2 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$gold" }
    $t1 = Get-SetCookieValue $g1 'refresh_token'; $t2 = Get-SetCookieValue $g2 'refresh_token'
    Check 'AUTH-T12' 'the same old token used twice in a row gets the same new tokens' '200 and 200 with one new token' "HTTP $($g1.Status) and $($g2.Status), same new token: $(($t1 -and ($t1 -eq $t2)))" (($g1.Status -eq 200) -and ($g2.Status -eq 200) -and $t1 -and ($t1 -eq $t2))
}
