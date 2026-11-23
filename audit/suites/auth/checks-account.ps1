# audit/suites/auth/checks-account.ps1 : schema, sign-up and login checks (AUTH-S, AUTH-A, AUTH-L).

function Test-AuthSchema {
    $cols = [int](Invoke-Sql "SELECT count(*) FROM information_schema.columns WHERE (table_name = 'refresh_tokens' AND column_name IN ('token_hash','revoked','consumed_at','parent_id')) OR (table_name = 'login_attempts' AND column_name IN ('email','failed_attempts','last_attempt_at')) OR (table_name = 'token_blacklist' AND column_name IN ('token_hash','expires_at'))")
    Check 'AUTH-S1' 'the session tables have the columns the code uses' '9 columns' "$cols columns" ($cols -eq 9)

    $len = [int](Invoke-Sql "SELECT coalesce(character_maximum_length, 0) FROM information_schema.columns WHERE table_name = 'token_blacklist' AND column_name = 'token_hash'")
    Check 'AUTH-S2' 'the token blacklist can hold a SHA-256 hash' 'char(64)' "length $len" ($len -eq 64)

    $type = Invoke-Sql "SELECT data_type FROM information_schema.columns WHERE table_name = 'login_attempts' AND column_name = 'last_attempt_at'"
    Check 'AUTH-S3' 'the lockout clock has a time zone' 'timestamp with time zone' $type ($type -eq 'timestamp with time zone')
}

function Test-AuthSignup {
    $main = New-AuthUser -Tag 'main'
    $Ctx.User = $main
    Check 'AUTH-A1' 'sign-up creates an account' '201' "$($main.Status)" ($main.Status -eq 201)

    $roleUser = New-AuthUser -Tag 'role' -Extra @{ role = 'admin' }
    $role = Invoke-Sql ("SELECT role FROM users WHERE email = {0}" -f (Get-SqlLiteral $roleUser.Email))
    Check 'AUTH-A2' 'a sign-up cannot choose its own role' 'created as customer' "HTTP $($roleUser.Status), role '$role'" (($roleUser.Status -eq 201) -and ($role -eq 'customer'))

    $wanted = [guid]::NewGuid().ToString()
    $idUser = New-AuthUser -Tag 'id' -Extra @{ id = $wanted }
    $gotId = Invoke-Sql ("SELECT id::text FROM users WHERE email = {0}" -f (Get-SqlLiteral $idUser.Email))
    $idNote = 'a different id was used'; if ($gotId -eq $wanted) { $idNote = 'the id from the request was used' }
    Check 'AUTH-A3' 'a sign-up cannot choose its own user id' 'a server-generated id' $idNote (($idUser.Status -eq 201) -and ($gotId -ne $wanted))

    $dup = New-AuthUser -Tag 'dup' -Email $main.Email
    Check 'AUTH-A4' 'the same email twice is refused cleanly' '409' "$($dup.Status)" ($dup.Status -eq 409)

    $caseUser = New-AuthUser -Tag 'case' -Email ($main.Email.ToUpper())
    Check 'AUTH-A5' 'the same email in another letter case is the same account' '409 (no second account)' "$($caseUser.Status)" ($caseUser.Status -eq 409)

    $s = [guid]::NewGuid().ToString('N').Substring(0, 8)
    $bad = [ordered]@{
        'invalid email'            = @{ name = 'A'; email = 'not-an-email'; password = 'Secret-123' }
        'password of 3 characters' = @{ name = 'A'; email = "audit_auth_v1_$s@example.com"; password = '123' }
        'no name'                  = @{ email = "audit_auth_v2_$s@example.com"; password = 'Secret-123' }
    }
    $codes = @(foreach ($k in $bad.Keys) { (Invoke-AuthHttp -Method POST -Path '/auth/signup' -Body ($bad[$k] | ConvertTo-Json -Compress)).Status })
    Check 'AUTH-A6' 'invalid sign-ups are rejected' '400 for each' ($codes -join ' ') (@($codes | Where-Object { $_ -ne 400 }).Count -eq 0)

    $long = New-AuthUser -Tag 'long' -Password ('Aa1-' + ('x' * 76))
    Check 'AUTH-A7' 'a password longer than bcrypt can use is refused' '400' "$($long.Status)" ($long.Status -eq 400)
}

function Test-AuthLogin {
    $s = New-AuthSession 'login'
    $leak = [bool]($s.Resp.Body -match '(?i)password|hash|reset')
    Check 'AUTH-L1' 'a correct login succeeds and the answer holds no secrets' '200, no password, hash or reset token' "HTTP $($s.Resp.Status), secrets in body: $leak" (($s.Resp.Status -eq 200) -and (-not $leak))

    $wrong = Invoke-AuthHttp -Method POST -Path '/auth/login' -Body (@{ email = $Ctx.User.Email; password = 'Wrong-Password-1' } | ConvertTo-Json -Compress)
    $ghost = 'audit_auth_ghost_' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '@example.com'
    $none  = Invoke-AuthHttp -Method POST -Path '/auth/login' -Body (@{ email = $ghost; password = 'Wrong-Password-1' } | ConvertTo-Json -Compress)
    $same  = ($wrong.Status -eq 401) -and ($none.Status -eq 401) -and ($wrong.Body -eq $none.Body)
    Check 'AUTH-L2' 'a wrong password and an unknown email get the same answer' 'two identical 401 answers' "$($wrong.Status) and $($none.Status), identical: $($wrong.Body -eq $none.Body)" $same

    $rows = [int](Invoke-Sql ("SELECT count(*) FROM login_attempts WHERE email = {0}" -f (Get-SqlLiteral $ghost)))
    Check 'AUTH-L3' 'failed logins for emails that do not exist leave no record' '0 rows' "$rows row(s)" ($rows -eq 0)
}
