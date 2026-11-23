# audit/suites/auth/checks-session.ps1 : cookies, CSRF, tokens, health and CORS (AUTH-C, AUTH-T, AUTH-E).

function Test-AuthCookies {
    $s = New-AuthSession 'cookies'
    $acc = Get-CookieAttr $s.Resp 'access_token'
    $ref = Get-CookieAttr $s.Resp 'refresh_token'
    $csr = Get-CookieAttr $s.Resp 'csrf_token'
    $ok = [bool]($acc -and $ref -and $csr -and $acc.HttpOnly -and $ref.HttpOnly -and (-not $csr.HttpOnly) -and $acc.SameSite -and $ref.SameSite)
    Check 'AUTH-C1' 'the session cookies are HttpOnly with SameSite; the CSRF cookie is readable' 'access and refresh HttpOnly, csrf not' ("access: $(Format-CookieFlags $acc); refresh: $(Format-CookieFlags $ref); csrf: $(Format-CookieFlags $csr)") $ok

    $secure = $false; if ($acc) { $secure = $acc.Secure }
    Add-Result 'AUTH-C2' 'the Secure flag on the session cookies' 'on in production (COOKIE_SECURE=true, or SameSite=None)' "Secure=$secure on this local HTTP run" 'INFO'

    $a1 = New-AuthSession 'csrf1'
    $r1 = Invoke-AuthHttp -Method POST -Path '/auth/logout' -Jar $a1.Jar
    Check 'AUTH-C3' 'logout without the CSRF header is refused' '403 CSRF_TOKEN_REQUIRED' "$($r1.Status) $(Get-Prop $r1.Json 'code')" (($r1.Status -eq 403) -and ((Get-Prop $r1.Json 'code') -eq 'CSRF_TOKEN_REQUIRED'))

    $a2 = New-AuthSession 'csrf2'
    $r2 = Invoke-AuthHttp -Method POST -Path '/auth/logout' -Jar $a2.Jar -Headers @{ $CsrfHeader = ('0' * 64) }
    Check 'AUTH-C4' 'logout with a wrong CSRF header is refused' '403 CSRF_TOKEN_INVALID' "$($r2.Status) $(Get-Prop $r2.Json 'code')" (($r2.Status -eq 403) -and ((Get-Prop $r2.Json 'code') -eq 'CSRF_TOKEN_INVALID'))
}

function Test-AuthTokens {
    $none = Invoke-AuthHttp -Method GET -Path '/auth/me'
    Check 'AUTH-T1' '/auth/me without a session is refused' '401' "$($none.Status)" ($none.Status -eq 401)

    $s = New-AuthSession 'me'
    $me = Invoke-AuthHttp -Method GET -Path '/auth/me' -Jar $s.Jar
    $meLeak = [bool]($me.Body -match '(?i)password|hash|reset')
    Check 'AUTH-T2' '/auth/me with a session returns the profile and no secrets' '200, own email, no secrets' "HTTP $($me.Status), email $(Get-Prop $me.Json 'user.email'), secrets: $meLeak" (($me.Status -eq 200) -and ((Get-Prop $me.Json 'user.email') -eq $Ctx.User.Email) -and (-not $meLeak))

    $codes = [ordered]@{}
    $forged = New-ForgedTokens $s.Access
    foreach ($name in $forged.Keys) {
        $codes[$name] = (Invoke-AuthHttp -Method GET -Path '/auth/me' -Headers @{ Authorization = ('Bearer ' + $forged[$name]) }).Status
    }
    $detail = (@($codes.Keys | ForEach-Object { "$_ = $($codes[$_])" }) -join '; ')
    Check 'AUTH-T3' 'forged tokens are refused' '401 for each of 3 forgeries' $detail (@($codes.Values | Where-Object { $_ -ne 401 }).Count -eq 0)

    $t = New-AuthSession 'logout'
    $oldAccess = $t.Access; $oldRefresh = $t.Refresh
    $out = Invoke-AuthHttp -Method POST -Path '/auth/logout' -Jar $t.Jar -Headers @{ $CsrfHeader = $t.Csrf }
    $replay = Invoke-AuthHttp -Method GET -Path '/auth/me' -Headers @{ Authorization = "Bearer $oldAccess" }
    $refresh = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Headers @{ Cookie = "refresh_token=$oldRefresh" }
    Check 'AUTH-T4' 'after logout the old access and refresh tokens are dead' 'logout 200, then 401 and 401' "logout $($out.Status), replay $($replay.Status) $(Get-Prop $replay.Json 'code'), refresh $($refresh.Status)" (($out.Status -eq 200) -and ($replay.Status -eq 401) -and ($refresh.Status -eq 401))

    $b = New-AuthSession 'bearer'
    $tok = $b.Access; $csrfValue = ('b' * 64)
    $bo = Invoke-AuthHttp -Method POST -Path '/auth/logout' -Headers @{ Authorization = "Bearer $tok"; Cookie = "csrf_token=$csrfValue"; $CsrfHeader = $csrfValue }
    $after = Invoke-AuthHttp -Method GET -Path '/auth/me' -Headers @{ Authorization = "Bearer $tok" }
    Check 'AUTH-T5' 'logging out with a Bearer token revokes it' 'logout 200, then 401' "logout $($bo.Status), then $($after.Status)" (($bo.Status -eq 200) -and ($after.Status -eq 401))

    $r = New-AuthSession 'refresh'
    $x = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Jar $r.Jar
    $newA = Get-CookieValue $r.Jar 'access_token'
    $newR = Get-CookieValue $r.Jar 'refresh_token'
    Check 'AUTH-T6' 'refresh issues a new access and a new refresh token' '200 and two new tokens' "HTTP $($x.Status), access changed: $($newA -ne $r.Access), refresh changed: $($newR -ne $r.Refresh)" (($x.Status -eq 200) -and ($newA -ne $r.Access) -and ($newR -ne $r.Refresh))

    $nc = Invoke-AuthHttp -Method POST -Path '/auth/refresh'
    Check 'AUTH-T7' 'refresh without a cookie is refused' '401' "$($nc.Status)" ($nc.Status -eq 401)
}

function Test-AuthEdge {
    $h = Invoke-AuthHttp -Method GET -Path '/health'
    $leak = [bool]($h.Body -match 'rate_limiting|skip_localhost')
    Check 'AUTH-E1' '/health does not describe the rate-limit settings' 'no rate-limit details' "HTTP $($h.Status), details shown: $leak" (($h.Status -eq 200) -and (-not $leak))

    $evil = Invoke-AuthHttp -Method OPTIONS -Path '/auth/login' -Headers @{ Origin = 'https://evil.example'; 'Access-Control-Request-Method' = 'POST' }
    $allow = Get-HeaderValue $evil 'Access-Control-Allow-Origin'
    $shown = 'none'; if ($allow) { $shown = $allow }
    Check 'AUTH-E2' 'an unknown website gets no CORS permission' 'no Access-Control-Allow-Origin' "HTTP $($evil.Status), header: $shown" (-not $allow)

    $good = Invoke-AuthHttp -Method OPTIONS -Path '/auth/login' -Headers @{ Origin = 'http://localhost:3000'; 'Access-Control-Request-Method' = 'POST' }
    $gAllow = Get-HeaderValue $good 'Access-Control-Allow-Origin'
    $gCred = Get-HeaderValue $good 'Access-Control-Allow-Credentials'
    Check 'AUTH-E3' 'the site itself gets CORS permission with credentials' 'origin echoed, credentials true' "HTTP $($good.Status), origin $gAllow, credentials $gCred" (($gAllow -eq 'http://localhost:3000') -and ($gCred -eq 'true'))
}
