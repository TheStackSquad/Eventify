# audit/suites/auth/hints-auth.ps1 : where to look for a failed check, the claims a pass supports, and the limits.

$AuthHints = @{
    'AUTH-X'  = 'A check group crashed. Read the message under it: usually the backend or the database stopped answering.'
    'AUTH-S1' = 'A column the auth code reads is missing. The rig database must be built from the baseline plus all migrations.'
    'AUTH-S2' = 'token_blacklist.token_hash must be char(64), or logout cannot store the SHA-256 hash.'
    'AUTH-S3' = 'F403: login_attempts.last_attempt_at has no time zone, and the code writes the server local time. IsAccountLocked compares it with UTC, so a server in Lagos time keeps accounts locked about an hour longer than 10 minutes. Migrate the column to timestamptz and write UTC.'
    'AUTH-A2' = 'The role must be forced to customer in Signup (it is today). If this fails, a sign-up can pick its role.'
    'AUTH-A3' = 'F417: the sign-up body binds straight into models.User, so id (and other fields) can be set by the caller. Bind into a request struct with only name, email and password.'
    'AUTH-A4' = 'F412: CreateUser turns every database error into "already exists" and the handler answers 500. Detect the unique violation (SQLSTATE 23505) and answer 409; report real errors as 500.'
    'AUTH-A5' = 'F416: emails are not normalised. Trim and lower-case them on sign-up, login and reset, and add a unique index on lower(email).'
    'AUTH-A6' = 'The binding rules (required, email, min=6) should give 400 for each of these.'
    'AUTH-A7' = 'F418: bcrypt uses at most 72 bytes. Refuse longer passwords with 400 (or pre-hash them); a 500 or a silently truncated password are both wrong.'
    'AUTH-L1' = 'The login answer must never contain a password, hash or reset token.'
    'AUTH-L2' = 'A wrong password and an unknown email must look the same. Compare status and body.'
    'AUTH-L3' = 'F419: Login records a failed attempt even when the email does not exist, so anyone can fill login_attempts. Record attempts only for existing accounts, or throttle by IP.'
    'AUTH-C1' = 'Session cookies must be HttpOnly with SameSite; the CSRF cookie must stay readable by the page.'
    'AUTH-C2' = 'F414: Secure depends on COOKIE_SECURE (default off). Production must set it, and logout must clear cookies with the same flags.'
    'AUTH-C3' = 'Authenticated state-changing routes must demand the X-CSRF-Token header.'
    'AUTH-C4' = 'The CSRF header must equal the cookie.'
    'AUTH-T1' = 'Protected routes must answer 401 without a token.'
    'AUTH-T2' = 'GetCurrentUser must return the profile only.'
    'AUTH-T3' = 'Tokens must be verified with RS256 only: no alg none, no tampered signature, no swapped payload.'
    'AUTH-T4' = 'Logout must blacklist the access token and revoke the refresh token.'
    'AUTH-T5' = 'F408: Logout reads the tokens from cookies only. A client that authenticates with a Bearer header is never revoked. Read the Authorization header as well.'
    'AUTH-T6' = 'Refresh must rotate both tokens.'
    'AUTH-T7' = 'Refresh without a cookie must be 401.'
    'AUTH-E1' = 'F413: /health tells anyone whether localhost is exempt from rate limits. Return status only.'
    'AUTH-E2' = 'CORS must name its origins. An unknown origin must get no Access-Control-Allow-Origin.'
    'AUTH-E3' = 'The site origin must get Access-Control-Allow-Origin and Allow-Credentials: true.'
}

function Get-AuthClaims {
    @(
        @{ Text = 'A sign-up cannot choose its own role, and invalid sign-ups are rejected.'; Needs = @('AUTH-A2', 'AUTH-A6') }
        @{ Text = 'A sign-up cannot choose its own user id.'; Needs = @('AUTH-A3') }
        @{ Text = 'A duplicate email is refused cleanly, in any letter case.'; Needs = @('AUTH-A4', 'AUTH-A5') }
        @{ Text = 'Login answers never expose secrets, and a wrong password and an unknown email look the same.'; Needs = @('AUTH-L1', 'AUTH-L2') }
        @{ Text = 'Session cookies are HttpOnly with SameSite, and state-changing requests need a matching CSRF token.'; Needs = @('AUTH-C1', 'AUTH-C3', 'AUTH-C4') }
        @{ Text = 'Forged, unsigned and re-signed tokens are refused.'; Needs = @('AUTH-T3') }
        @{ Text = 'Logout kills the access and the refresh token, whichever way the client authenticated.'; Needs = @('AUTH-T4', 'AUTH-T5') }
        @{ Text = 'Refresh rotates both tokens and needs a session.'; Needs = @('AUTH-T6', 'AUTH-T7') }
        @{ Text = 'Only the named website origin receives CORS permission.'; Needs = @('AUTH-E2', 'AUTH-E3') }
    )
}

function Get-AuthLimits {
    @(
        '- This run uses a local backend and the rig database; no tunnel is used.',
        '- Rate limiting is not exercised: the limiter skips localhost, so those checks need rig mode (a later piece).',
        '- Lockout, token expiry, session lifetime and the password-reset flow are covered by later pieces.'
    )
}
