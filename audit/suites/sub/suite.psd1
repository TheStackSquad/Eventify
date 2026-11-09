# audit/suites/sub/suite.psd1

@{
    Id            = 'SUB'
    Title         = 'Subscriptions and the shared Paystack webhook'
    Tags          = @('money', 'fast')
    Modes         = @('rig', 'tunnel')
    Orchestrator  = 'core/orchestrate.ps1'
    NeedsStub     = $true            # rig mode; tunnel mode uses real Paystack
    NeedsTunnel   = $false           # only for -Manual
    CheckPrefix   = 'T'
    FixturePrefix = 'audit_vendor'
    Requires      = 5
    Order         = 10               # runs before ORD
    Destructive   = $false           # touches only the audit_vendor* accounts and their rows
    DbZones       = @('UTC', 'Africa/Lagos')
    FindingRange  = 'F1-F199'
    Owner         = 'SUB/rig agent'
}