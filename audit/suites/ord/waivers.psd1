# audit/suites/ord/waivers.psd1
# A waiver parks one KNOWN failing check, with a reason and an expiry date, while the decision behind it is pending.
# The check still runs and still appears in the report as WAIVED. An expired waiver turns the check back into a FAIL.
# When the check starts passing, the report tells you to delete the entry.
@{
    Waivers = @(
        @{
            Check   = 'ORD-P8.1'
            Finding = 'F209'
            Reason  = 'the fee model is being redesigned as a VAT-inclusive all-in price; the 500000/500001 kobo inversion disappears with it'
            Added   = '2026-11-17'
            Expires = '2026-12-31'
        }
    )
}
