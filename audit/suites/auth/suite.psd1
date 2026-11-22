@{
    Id            = 'AUTH'
    Title         = 'Sign-up, login, cookies, CSRF and tokens'
    Tags          = @('security', 'fast')
    Modes         = @('tunnel')            # rig mode arrives with the rate-limit checks
    Orchestrator  = 'suites/auth/orchestrate-auth.ps1'
    NeedsStub     = $false
    NeedsTunnel   = $false
    CheckPrefix   = 'AUTH'
    FixturePrefix = 'audit_auth_'
    Requires      = 13
    Order         = 30
    Destructive   = $false                 # touches only audit_auth_* accounts
    DbZones       = @('UTC', 'Africa/Lagos')
    FindingRange  = 'F400-F499'
    Owner         = 'SUB/rig agent'
}
