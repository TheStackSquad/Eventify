# //audit/run-subscription-emails.ps1

# This correctly gets C:\Users\drag-\eventify\audit from the rig folder
$rootDir = Split-Path -Parent $PSScriptRoot

# Then use $rootDir for your paths:
Get-Content "$rootDir\sql\seed_subscriptions.sql" | docker ... -v "$rootDir\docker\docker-compose.loadtest.yml" ...

param([ValidateSet('current','fixed')][string]$Mode = 'current')
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$dc = 'docker\docker-compose.loadtest.yml'
$p = @('compose','-f',$dc,'exec','-T','db','psql','-U','loadtest','-d','eventify_loadtest','-At')
function One($q) { ((docker @p -c $q) | Select-Object -First 1) }

$start = One "SELECT clock_timestamp()::text"
Write-Host '1/4 seed one vendor and subscription per scenario'
# Get-Content audit\sql\seed_subscriptions.sql | docker @p -v ON_ERROR_STOP=1 | Out-Null
Get-Content sql\seed_subscriptions.sql | docker @p -v ON_ERROR_STOP=1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host 'seed failed'; exit 1 }

$expected = if ($Mode -eq 'current') { 7 } else { 5 }
$mine = "recipient_email LIKE 'sub-%@example.com' AND created_at > '$start'"

Write-Host "2/4 waiting for the subscription worker (expecting $expected emails)"
$deadline = (Get-Date).AddSeconds(150)
do { Start-Sleep 5; $n = [int](One "SELECT count(*) FROM email_outbox WHERE $mine") } while ($n -lt $expected -and (Get-Date) -lt $deadline)

Write-Host '3/4 waiting for delivery, then two more worker passes to prove nothing repeats'
for ($i = 0; $i -lt 24; $i++) {
  if ([int](One "SELECT count(*) FROM email_outbox WHERE $mine AND status IN ('pending','processing')") -eq 0) { break }
  Start-Sleep 5
}
$n1 = [int](One "SELECT count(*) FROM email_outbox WHERE $mine")
Start-Sleep 50
$n2 = [int](One "SELECT count(*) FROM email_outbox WHERE $mine")

Write-Host '4/4 verdict'
$rows = docker @p -c "SELECT substring(recipient_email from '^sub-([a-z0-9]+)-'), template_type, status FROM email_outbox WHERE $mine ORDER BY 1, 2"
$got = @{}
foreach ($line in @($rows)) {
  if (-not $line) { continue }
  $f = $line -split '\|'
  if (-not $got.ContainsKey($f[0])) { $got[$f[0]] = @() }
  $got[$f[0]] += "$($f[1])/$($f[2])"
}
$flaw = if ($Mode -eq 'current') { 'SUBSCRIPTION_EXPIRED' } else { '' }
$expect = [ordered]@{
  pay = 'SUBSCRIPTION_PAYMENT_SUCCESS'; r7 = 'SUBSCRIPTION_REMINDER_7D'; r3 = 'SUBSCRIPTION_REMINDER_3D'
  r1 = 'SUBSCRIPTION_REMINDER_1D'; exp = 'SUBSCRIPTION_EXPIRED'; optout = ''; noauto = ''
  stale = $flaw; renewed = $flaw
}
$bad = 0
foreach ($tag in $expect.Keys) {
  $want = if ($expect[$tag]) { "$($expect[$tag])/sent" } else { '' }
  $have = if ($got.ContainsKey($tag)) { ($got[$tag] -join ',') } else { '' }
  $ok = ($want -eq $have)
  if (-not $ok) { $bad++ }
  '{0,-8} {1,-5} want [{2}] got [{3}]' -f $tag, $(if ($ok) { 'ok' } else { 'WRONG' }), $want, $have
}
"queued: $n1, then $n2 after two more passes (must match)"
if ($Mode -eq 'current') { 'Mode current: stale and renewed are EXPECTED to send. That is the known flaw (S1, S2).' }
if ($bad -eq 0 -and $n1 -eq $n2 -and $n1 -eq $expected) { "PASS ($Mode)" } else { "FAIL ($Mode)" }