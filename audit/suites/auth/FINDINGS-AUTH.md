# AUTH findings register (F400-F499)

Status "Confirmed" means a check in this suite failed against the code on 2026-11-21. "Suspected" comes from reading the code; a check will confirm or clear it. Severities are provisional.

| ID | Sev | Status | Finding | Check |
|---|---|---|---|---|
| F400 | High | Suspected | Rate limits on sign-up and login can be bypassed: the limiter key includes the source port, and a client-set header skips it for "localhost" | rig mode |
| F401 | Med | Suspected | An unknown email gets its answer faster than a known one (no password hashing happens) | AUTH-L4 |
| F402 | Med | Suspected | Anyone can lock a victim's account for 10 minutes with 5 wrong passwords | AUTH-K |
| F403 | Med | Confirmed (schema) | login_attempts.last_attempt_at has no time zone; behaviour under a Lagos-time server to be tested | AUTH-S3, AUTH-K |
| F404 | Med | Suspected | Two refreshes at once with one token both succeed and mint different tokens | AUTH-T8 |
| F405 | Med | Suspected | Refresh ignores the stored expiry of the token | AUTH-T9 |
| F406 | Med | Suspected | A session never reaches an absolute end: every refresh restarts the 30-day life | AUTH-T10 |
| F407 | Med | Suspected | Old access tokens keep working for up to 24 hours after a password reset | AUTH-R |
| F408 | Med | Confirmed | Logging out with a Bearer token does not revoke it | AUTH-T5 |
| F409 | Med | Suspected | Reset tokens are stored in plain text | AUTH-R |
| F410 | High | Suspected | Reset tokens are written to the request log (query string) | AUTH-R |
| F411 | High | Suspected | Forgot-password sends no email, so the reset flow cannot work | AUTH-R |
| F412 | Low | Confirmed | Signing up twice with one email returns 500 | AUTH-A4 |
| F413 | Low | Confirmed | /health discloses the rate-limit configuration | AUTH-E1 |
| F414 | Med | Suspected | Cookie Secure defaults to off; logout clears cookies with Secure off | AUTH-C2 |
| F415 | Low | Suspected | An IP or browser change on refresh is only logged; /auth/refresh skips CSRF | AUTH-T |
| F416 | Med | Confirmed | Emails are not normalised: the same address in another letter case is a second account | AUTH-A5 |
| F417 | Med | Confirmed | A sign-up can choose its own user id | AUTH-A3 |
| F418 | Low | Confirmed | A password longer than 72 bytes gives a 500 | AUTH-A7 |
| F419 | Med | Confirmed | Failed logins for emails that do not exist write rows to login_attempts | AUTH-L3 |
| F420 | Low | Suspected | AdminMiddleware compares errors with errors.Is on a fresh error, so a deleted admin gets 500 instead of 403 | AUTH-P |
| F421 | Med | Suspected | Two simultaneous resets with one token can both succeed | AUTH-R |
