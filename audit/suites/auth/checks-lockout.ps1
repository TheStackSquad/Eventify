# audit/suites/auth/checks-lockout.ps1 : login letter case, login timing and account lockout (AUTH-L4, AUTH-L5, AUTH-K).

function Get-AuthMedianMs([scriptblock]$Call, [int]$Count) {
    $ms = @(1..$Count | ForEach-Object { (Measure-Command { $null = & $Call }).TotalMilliseconds } | Sort-Object)
    return [double]$ms[[int][math]::Floor(($ms.Count - 1) / 2)]
}

function Test-AuthLockout {
    # AUTH-L5: the letter case of the email does not matter at login
    $upper = [pscustomobject]@{ Email = $Ctx.User.Email.ToUpper(); Password = $Ctx.User.Password }
    $ul = Invoke-AuthLogin $upper (Join-Path $Tmp 'upper.jar')
    Check 'AUTH-L5' 'login works whatever the letter case of the email' '200' "$($ul.Status)" ($ul.Status -eq 200)

    # AUTH-L4: an unknown email takes about as long to refuse as a known one (a known email costs one password hash)
    $t = New-AuthUser -Tag 'timing'
    $knownBody = @{ email = $t.Email; password = 'Wrong-Password-1' } | ConvertTo-Json -Compress
    $ghostMail = 'audit_auth_ghost_' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '@example.com'
    $ghostBody = @{ email = $ghostMail; password = 'Wrong-Password-1' } | ConvertTo-Json -Compress
    $overhead = Get-AuthMedianMs { Invoke-AuthHttp -Method GET -Path '/health' } 4
    $known    = (Get-AuthMedianMs { Invoke-AuthHttp -Method POST -Path '/auth/login' -Body $knownBody } 4) - $overhead
    $unknown  = (Get-AuthMedianMs { Invoke-AuthHttp -Method POST -Path '/auth/login' -Body $ghostBody } 4) - $overhead
    if ($known -lt 15) {
        Add-Result 'AUTH-L4' 'an unknown email takes as long to refuse as a known one' 'comparable times' ('the password check is too fast to measure here ({0:N0} ms)' -f $known) 'INFO'
    }
    else {
        Check 'AUTH-L4' 'an unknown email takes as long to refuse as a known one' 'unknown at least half as slow as known' ('known {0:N0} ms, unknown {1:N0} ms (request overhead removed)' -f $known, $unknown) ($unknown -ge (0.5 * $known))
    }

    # AUTH-K: lockout
    $u = New-AuthUser -Tag 'lock'
    $wrong = @{ email = $u.Email; password = 'Wrong-Password-1' } | ConvertTo-Json -Compress
    $codes = @(1..5 | ForEach-Object { (Invoke-AuthHttp -Method POST -Path '/auth/login' -Body $wrong).Status })
    $locked = Invoke-AuthLogin $u (Join-Path $Tmp 'locked.jar')
    Check 'AUTH-K1' 'five wrong passwords lock the account, even for the right password' '5 x 401, then 403' (($codes -join ' ') + ", then $($locked.Status)") ((@($codes | Where-Object { $_ -ne 401 }).Count -eq 0) -and ($locked.Status -eq 403))

    $lit  = Get-SqlLiteral $u.Email.ToLower()
    $type = Invoke-Sql "SELECT data_type FROM information_schema.columns WHERE table_name = 'login_attempts' AND column_name = 'last_attempt_at'"
    $expr = "(now() AT TIME ZONE 'UTC') - last_attempt_at"
    if ($type -eq 'timestamp with time zone') { $expr = 'now() - last_attempt_at' }
    $raw  = Invoke-Sql "SELECT round(extract(epoch FROM ($expr)))::int FROM login_attempts WHERE email = $lit"
    $diff = 99999
    if ($raw -match '^-?\d+$') { $diff = [int]$raw }
    Check 'AUTH-K2' 'the time of the last failed login is stored as the real time' 'within 2 minutes of now' "$diff seconds (this PC time zone: $([TimeZoneInfo]::Local.Id))" ([math]::Abs($diff) -lt 120)

    $null = Invoke-Sql "UPDATE login_attempts SET last_attempt_at = last_attempt_at - interval '11 minutes' WHERE email = $lit"
    $after = Invoke-AuthLogin $u (Join-Path $Tmp 'unlocked.jar')
    Check 'AUTH-K3' 'the lock ends once the last failed login is 11 minutes old' '200' "$($after.Status)" ($after.Status -eq 200)
}
