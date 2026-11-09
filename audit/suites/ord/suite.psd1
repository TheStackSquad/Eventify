# audit/ suites/ord/suite.psd1

@{
    Id            = 'ORD'
    Title         = 'Orders, payments and tickets'
    Tags          = @('money', 'slow')
    Modes         = @('rig', 'tunnel')
    Orchestrator  = 'suites\ord\orchestrate-ord.ps1'
    NeedsStub     = $true            # rig mode; tunnel mode uses real Paystack
    NeedsTunnel   = $false           # only for -Manual
    CheckPrefix   = 'ORD'
    FixturePrefix = 'AUDIT-ORD'
    Requires      = 5                # minimum migration number; raised as ORD migrations land
    Order         = 20               # SUB runs first
    Destructive   = $false           # touches only AUDIT-ORD / audit_ord_* rows
    DbZones       = @('UTC', 'Africa/Lagos')   # the reaper checks run under both
    FindingRange  = 'F200-F299'
    Owner         = 'ORD agent'
}