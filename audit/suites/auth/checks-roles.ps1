# audit/suites/auth/checks-roles.ps1 : who may call the admin routes (AUTH-P1 to AUTH-P5).

function New-AuthSessionFor($User, [string]$Label) {
    $jar = Join-Path $Tmp ("$Label-" + [guid]::NewGuid().ToString('N').Substring(0, 6) + '.jar')
    $r = Invoke-AuthLogin $User $jar
    [pscustomobject]@{ Jar = $jar; Resp = $r; Csrf = (Get-CookieValue $jar 'csrf_token') }
}

function Test-AuthRoles {
    $path = '/api/v1/admin/feedback'
    $none = Invoke-AuthHttp -Method GET -Path $path
    Check 'AUTH-P1' 'an admin route without a session is refused' '401' "$($none.Status)" ($none.Status -eq 401)

    $cust = New-AuthUser -Tag 'cust'
    $cs = New-AuthSessionFor $cust 'cust'
    $c = Invoke-AuthHttp -Method GET -Path $path -Jar $cs.Jar
    Check 'AUTH-P2' 'a customer cannot read an admin route' '403' "$($c.Status)" ($c.Status -eq 403)

    $h = @{}; $h[$CsrfHeader] = $cs.Csrf
    $w = Invoke-AuthHttp -Method POST -Path '/api/v1/admin/analytics/refresh' -Jar $cs.Jar -Headers $h
    Check 'AUTH-P3' 'a customer cannot use an admin action' '403' "$($w.Status)" ($w.Status -eq 403)

    $adm = New-AuthUser -Tag 'admin'
    $lit = Get-SqlLiteral $adm.Email.ToLower()
    $null = Invoke-Sql "UPDATE users SET role = 'admin' WHERE lower(email) = $lit"
    $as = New-AuthSessionFor $adm 'admin'
    $a = Invoke-AuthHttp -Method GET -Path $path -Jar $as.Jar
    Check 'AUTH-P4' 'an admin can read an admin route' '200' "$($a.Status)" ($a.Status -eq 200)

    # F420: a valid token whose account no longer exists
    $null = Invoke-Sql "DELETE FROM users WHERE lower(email) = $lit"
    $gone = Invoke-AuthHttp -Method GET -Path $path -Jar $as.Jar
    Check 'AUTH-P5' 'a deleted admin with a still-valid token is refused with 403, not a server error' '403' "$($gone.Status)" ($gone.Status -eq 403)
}
