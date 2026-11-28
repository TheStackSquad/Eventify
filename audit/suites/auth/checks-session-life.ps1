# audit/suites/auth/checks-session-life.ps1 : the life a refresh token is given (AUTH-T13, AUTH-T14).

function Get-AuthTokenLifeHours([string]$Refresh) {
    $v = Invoke-Sql ("SELECT round(extract(epoch FROM (expires_at - created_at)) / 3600) FROM refresh_tokens WHERE token_hash = {0}" -f (Get-SqlLiteral (Get-TokenSha $Refresh)))
    if ($v -match '^-?\d+(\.\d+)?$') { return [double]$v }
    return -1
}

function Test-AuthSessionLife {
    $short = Join-Path $Tmp ('life-short-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.jar')
    $null = Invoke-AuthLogin $Ctx.User $short $false
    $shortAtLogin = Get-AuthTokenLifeHours (Get-CookieValue $short 'refresh_token')
    $r1 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Jar $short
    $shortAfter = Get-AuthTokenLifeHours (Get-CookieValue $short 'refresh_token')
    Check 'AUTH-T13' 'a browser session keeps its 24 hour life when it is refreshed' '23 to 25 hours' "at login $shortAtLogin h; after a refresh (HTTP $($r1.Status)) $shortAfter h" (($r1.Status -eq 200) -and ($shortAfter -ge 23) -and ($shortAfter -le 25))

    $long = Join-Path $Tmp ('life-long-' + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.jar')
    $null = Invoke-AuthLogin $Ctx.User $long $true
    $longAtLogin = Get-AuthTokenLifeHours (Get-CookieValue $long 'refresh_token')
    $r2 = Invoke-AuthHttp -Method POST -Path '/auth/refresh' -Jar $long
    $longAfter = Get-AuthTokenLifeHours (Get-CookieValue $long 'refresh_token')
    Check 'AUTH-T14' 'a "remember me" session keeps its 30 day life when it is refreshed' '700 to 721 hours' "at login $longAtLogin h; after a refresh (HTTP $($r2.Status)) $longAfter h" (($r2.Status -eq 200) -and ($longAfter -ge 700) -and ($longAfter -le 721))
}
