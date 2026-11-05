# // audit/matrix/checks-webhook.ps1

# audit/matrix/checks-webhook.ps1 : what happens to signed and unsigned webhooks (the inbox, retries and orphans).

function Get-InboxCount { [int](Invoke-Sql "SELECT count(*) FROM webhook_inbox") }

# "status|attempts" of the newest inbox row matching a WHERE clause (only our own GUIDs and hashes go in), or empty.
function Get-InboxRow([string]$Where) {
    Invoke-Sql "SELECT status || '|' || attempts FROM webhook_inbox WHERE $Where ORDER BY id DESC LIMIT 1"
}

function Get-BodyHash([string]$Body) {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Body)) | ForEach-Object { $_.ToString("x2") })
}

# T3d real-shaped webhook for an unknown reference, T3f re-delivery, T3e unreadable signed body,
# T3g unsigned body, T3h payment metadata stripped
function Test-WebhookInbox($Ctx) {
    $ghost = [guid]::NewGuid().ToString()
    $body = New-ChargeBody $ghost $Ctx.Vid 1000000
    $r1 = Send-Webhook $body (Get-PaystackSignature $body)
    $row1 = Get-InboxRow "reference = '$ghost'"
    Check "T3d.1" "a real-shaped webhook for an unknown reference is kept as an orphan" "200 and status orphan" "$($r1.Status), $row1" (($r1.Status -eq 200) -and ($row1 -like 'orphan|*'))

    $r2 = Send-Webhook $body (Get-PaystackSignature $body)
    $rows = [int](Invoke-Sql "SELECT count(*) FROM webhook_inbox WHERE reference = '$ghost'")
    $row2 = Get-InboxRow "reference = '$ghost'"
    Check "T3f.1" "the same webhook delivered again is counted, not duplicated" "200, one row, 2 attempts" "$($r2.Status), $rows row(s), $row2" (($r2.Status -eq 200) -and ($rows -eq 1) -and ($row2 -like '*|2'))

    $junk = "this is not json " + [guid]::NewGuid().ToString("N")
    $r3 = Send-Webhook $junk (Get-PaystackSignature $junk)
    $row3 = Get-InboxRow ("body_sha256 = '{0}'" -f (Get-BodyHash $junk))
    Check "T3e.1" "a signed body we cannot read is kept and Paystack is told to retry" "500 and status failed" "$($r3.Status), $row3" (($r3.Status -eq 500) -and ($row3 -like 'failed|*'))

    $b4 = New-ChargeBody ([guid]::NewGuid().ToString()) $Ctx.Vid 1000000
    $n0 = Get-InboxCount
    $r4 = Send-Webhook $b4 "0000bad0"
    $n1 = Get-InboxCount
    Check "T3g.1" "a wrongly signed webhook is rejected and never stored" "401 and +0 inbox rows" "$($r4.Status), +$($n1 - $n0)" (($r4.Status -eq 401) -and ($n1 -eq $n0))

    $g5 = [guid]::NewGuid().ToString()
    $b5 = (New-ChargeBody $g5 $Ctx.Vid 1000000) -replace '"payment_type"\s*:\s*"subscription"\s*,\s*', ''
    $r5 = Send-Webhook $b5 (Get-PaystackSignature $b5)
    $row5 = Get-InboxRow "reference = '$g5'"
    Check "T3h.1" "a payment with no type in its metadata is checked against both ledgers, then kept as an orphan" "200 and status orphan" "$($r5.Status), $row5" (($r5.Status -eq 200) -and ($row5 -like 'orphan|*'))
}