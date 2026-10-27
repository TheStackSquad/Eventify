# audit/matrix/helpers.ps1
# Recording, safety checks, SQL, HTTP, sessions, webhooks and database state.
# Dot-sourced by run-ngrok-matrix.ps1. These functions rely on the main script's variables
# ($Results, $Tmp, $Port, $Rig, $RunInfo, $BaseUrl, $Sub, $Webhook, $Price, ...).

# Loads AUDIT_* credentials (plus PAYSTACK_SECRET_KEY and FRONTEND_URL) from a KEY=value file into this
# process only. Strips surrounding quotes, skips comments and blank lines, accepts "export KEY=value".
# Other names are ignored on purpose: the tunnel-mode backend inherits this environment, so loading its
# database or key settings from a file could silently change what it connects to. Values are never printed.
function Import-EnvFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { Stop-Setup "env file not found: $Path" }
    $loaded = 0
    foreach ($line in Get-Content -LiteralPath $Path) {
        $t = $line.Trim()
        if ((-not $t) -or $t.StartsWith("#")) { continue }
        if ($t -match '^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name = $Matches[1]
            $value = $Matches[2].Trim()
        }
        else { continue }
        if ($name -notmatch '^(AUDIT_|PAYSTACK_SECRET_KEY$|FRONTEND_URL$)') { continue }
        if ($value -match '^"(.*)"$') { $value = $Matches[1] }
        elseif ($value -match "^'(.*)'$") { $value = $Matches[1] }
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        $loaded++
    }
    if ($loaded -eq 0) { Stop-Setup "no AUDIT_* variables were found in $Path" }
}

function Set-Endpoints {
    $script:BaseUrl = "http://localhost:$($script:Port)"
    $script:Sub = "$($script:BaseUrl)/api/v1/subscription"
    if ($script:Rig) { $script:PublicBase = $script:BaseUrl } else { $script:PublicBase = "https://$($script:NgrokDomain)" }
    $script:Webhook = "$($script:PublicBase)/api/webhooks/paystack"
}

# ---------------------------------------------------------------- recording

function Add-Result([string]$Id, [string]$Name, [string]$Expected, [string]$Actual, [string]$Outcome, [string]$Note = "") {
    $Results.Add([pscustomobject]@{ Id = $Id; Name = $Name; Expected = $Expected; Actual = $Actual; Outcome = $Outcome; Note = $Note })
    $color = switch ($Outcome) { "PASS" { "Green" } "FAIL" { "Red" } "SKIP" { "DarkYellow" } default { "Cyan" } }
    Write-Host ("[{0}] {1} {2}  (expected: {3} | got: {4})" -f $Outcome, $Id, $Name, $Expected, $Actual) -ForegroundColor $color
    if ($Note) { Write-Host "       $Note" -ForegroundColor DarkGray }
}

function Check([string]$Id, [string]$Name, [string]$Expected, [string]$Actual, [bool]$Ok, [string]$Note = "") {
    $outcome = "FAIL"
    if ($Ok) { $outcome = "PASS" }
    Add-Result $Id $Name $Expected $Actual $outcome $Note
}

function Stop-Setup([string]$Message) { $script:KeepTmp = $true; throw "SETUP FAILED: $Message" }

# ---------------------------------------------------------------- safety and helpers

function Assert-Safety {
    foreach ($v in "PAYSTACK_SECRET_KEY", "AUDIT_DB_URL", "AUDIT_VENDOR_EMAIL", "AUDIT_VENDOR_PASSWORD") {
        if (-not [Environment]::GetEnvironmentVariable($v)) { Stop-Setup "environment variable $v is not set" }
    }
    foreach ($v in "AUDIT_VENDOR_EMAIL", "AUDIT_VENDOR2_EMAIL") {
        $val = [Environment]::GetEnvironmentVariable($v)
        if ($val -and ($val -notmatch '^[^@\s"'']+@[^@\s"'']+$')) {
            Stop-Setup "$v does not look like a plain email address: [$val]. Remove any quotes or spaces. A value that still contains its quote characters (left over in this terminal session from an earlier import) is the usual cause; open a fresh terminal or use -EnvFile."
        }
    }
    if (-not $env:PAYSTACK_SECRET_KEY.StartsWith("sk_test_")) { Stop-Setup "the Paystack secret key is not a test key; refusing to run" }
    if ($env:AUDIT_DB_URL -notmatch "@(localhost|127\.0\.0\.1)[:/]") { Stop-Setup "the database must be on localhost" }
}

# Runs a native command and returns its exit code and combined output, without letting
# $ErrorActionPreference = "Stop" turn stderr lines into exceptions (Windows PowerShell 5.1).
function Invoke-NativeCapture([string]$File, [string[]]$Arguments) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { $out = & $File @Arguments 2>&1 } finally { $ErrorActionPreference = $prev }
    $code = $LASTEXITCODE
    $text = (@($out | ForEach-Object { "$_" }) -join "`n").Trim()
    [pscustomobject]@{ ExitCode = $code; Output = $text }
}

function Invoke-Sql([string]$Sql) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { $out = & psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -t -A -q -c $Sql 2>&1 } finally { $ErrorActionPreference = $prev }
    if ($LASTEXITCODE -ne 0) { throw "psql failed: $(($out | Out-String).Trim())" }
    ($out | Out-String).Trim()
}

function Get-SqlLiteral([string]$Text) { "'" + $Text.Replace("'", "''") + "'" }

function Assert-Guid([string]$Value, [string]$What) {
    if ($Value -notmatch '^[0-9a-fA-F-]{36}$') { throw "unexpected $What format" }
}

function Get-PaystackSignature([string]$Body) {
    $key = [Text.Encoding]::UTF8.GetBytes($env:PAYSTACK_SECRET_KEY)
    $hmac = [System.Security.Cryptography.HMACSHA512]::new($key)
    $bytes = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($Body))
    -join ($bytes | ForEach-Object { $_.ToString("x2") })
}

function Get-Prop($Obj, [string]$Path) {
    foreach ($part in $Path.Split(".")) {
        if ($null -eq $Obj) { return $null }
        if ($Obj.PSObject.Properties.Name -notcontains $part) { return $null }
        $Obj = $Obj.$part
    }
    $Obj
}

# curl.exe gives identical status handling on Windows PowerShell 5.1 and PowerShell 7.
function Invoke-Http {
    param(
        [string]$Method,
        [string]$Url,
        [string]$Jar = "",
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$ContentType = "application/json"
    )
    $outFile = Join-Path $Tmp ([guid]::NewGuid().ToString("N") + ".out")
    $curl = @("-s", "-S", "--max-time", "30", "-o", $outFile, "-w", "%{http_code}", "-X", $Method)
    if ($Jar) { $curl += @("-b", $Jar, "-c", $Jar) }
    $Headers["ngrok-skip-browser-warning"] = "1"
    foreach ($k in $Headers.Keys) { $curl += @("-H", ("{0}: {1}" -f $k, $Headers[$k])) }
    if ($null -ne $Body) {
        $bodyFile = Join-Path $Tmp ([guid]::NewGuid().ToString("N") + ".body")
        # UTF-8 without BOM: the webhook signature is computed over these exact bytes.
        [IO.File]::WriteAllText($bodyFile, $Body, (New-Object Text.UTF8Encoding($false)))
        $curl += @("-H", "Content-Type: $ContentType", "--data-binary", "@$bodyFile")
    }
    $curl += $Url
    $code = & curl.exe @curl
    $text = ""
    if (Test-Path -LiteralPath $outFile) {
        $raw = Get-Content -Raw -LiteralPath $outFile
        if ($null -ne $raw) { $text = $raw }
    }
    $json = $null
    try { if ($text) { $json = $text | ConvertFrom-Json } } catch { $json = $null }
    [pscustomobject]@{ Status = [int]$code; Body = $text; Json = $json }
}

function Get-CookieValue([string]$Jar, [string]$Name) {
    if (-not (Test-Path -LiteralPath $Jar)) { return $null }
    foreach ($line in Get-Content -LiteralPath $Jar) {
        $l = $line -replace "^#HttpOnly_", ""
        if (-not $l.Trim() -or $l.StartsWith("#")) { continue }
        $f = $l -split "`t"
        if ($f.Count -ge 7 -and $f[5] -eq $Name) { return $f[6] }
    }
    $null
}

function New-Session([string]$Email, [string]$Password, [string]$Label) {
    $jar = Join-Path $Tmp "$Label.jar"
    $body = @{ email = $Email; password = $Password } | ConvertTo-Json -Compress
    $r = Invoke-Http -Method POST -Url "$BaseUrl$LoginPath" -Jar $jar -Body $body
    if ($r.Status -eq 403) {
        # some CSRF setups hand out the token on any GET first
        Invoke-Http -Method GET -Url "$Sub/plans" -Jar $jar | Out-Null
        $pre = Get-CookieValue $jar $CsrfCookie
        $h = @{}
        if ($pre) { $h[$CsrfHeader] = $pre }
        $r = Invoke-Http -Method POST -Url "$BaseUrl$LoginPath" -Jar $jar -Headers $h -Body $body
    }
    if ($r.Status -ne 200) {
        $snippet = [string]$r.Body
        if ($snippet.Length -gt 300) { $snippet = $snippet.Substring(0, 300) }
        Stop-Setup "login for $Label returned HTTP $($r.Status) from $BaseUrl$LoginPath as '$Email'. Server said: $snippet"
    }
    [pscustomobject]@{ Jar = $jar; Csrf = (Get-CookieValue $jar $CsrfCookie); Label = $Label }
}

function Invoke-Auth($Session, [string]$Method, [string]$Path, [string]$Body = $null, [switch]$NoCsrf) {
    $h = @{}
    if ($Session.Csrf -and -not $NoCsrf -and $Method -ne "GET") { $h[$CsrfHeader] = $Session.Csrf }
    Invoke-Http -Method $Method -Url "$Sub$Path" -Jar $Session.Jar -Headers $h -Body $Body
}

function Send-Webhook([string]$Body, [string]$Signature) {
    $h = @{}
    if ($Signature) { $h["x-paystack-signature"] = $Signature }
    Invoke-Http -Method POST -Url $Webhook -Headers $h -Body $Body
}

function New-ChargeBody([string]$Reference, [string]$VendorId, [int64]$Amount) {
    @{
        event = "charge.success"
        data  = @{
            reference = $Reference; status = "success"; amount = $Amount; currency = "NGN"
            metadata  = @{ payment_type = "subscription"; vendor_id = $VendorId }
        }
    } | ConvertTo-Json -Depth 6 -Compress
}

function Get-StubVerify([string]$Reference) {
    Invoke-Http -Method GET -Url "$($RunInfo.StubBase)/transaction/verify/$Reference" -Headers @{ Authorization = "Bearer $($env:PAYSTACK_SECRET_KEY)" }
}

# ---------------------------------------------------------------- database state

function Get-VendorId([string]$Email) {
    Invoke-Sql ("SELECT v.id FROM vendors v JOIN users u ON u.id = v.owner_id WHERE lower(u.email) = lower({0}) LIMIT 1" -f (Get-SqlLiteral $Email))
}

function Get-State([string]$VendorId) {
    Assert-Guid $VendorId "vendor id"
    [pscustomobject]@{
        Subs   = [int](Invoke-Sql "SELECT count(*) FROM subscriptions WHERE vendor_id = '$VendorId'")
        Active = [int](Invoke-Sql "SELECT count(*) FROM subscriptions WHERE vendor_id = '$VendorId' AND status = 'active'")
        Expiry = (Invoke-Sql "SELECT coalesce(max(expires_at)::text, '') FROM subscriptions WHERE vendor_id = '$VendorId' AND status = 'active'")
        Tier   = (Invoke-Sql "SELECT subscription_tier FROM vendors WHERE id = '$VendorId'")
    }
}

function Test-SameState($A, $B) {
    ($A.Subs -eq $B.Subs) -and ($A.Active -eq $B.Active) -and ($A.Expiry -eq $B.Expiry) -and ($A.Tier -eq $B.Tier)
}

function Get-LedgerCount { [int](Invoke-Sql "SELECT count(*) FROM subscription_payments") }
function Get-SubscriptionCount { [int](Invoke-Sql "SELECT count(*) FROM subscriptions") }

function Get-Ledger([string]$Reference) {
    Assert-Guid $Reference "reference"
    $row = Invoke-Sql "SELECT status || '|' || amount_kobo || '|' || vendor_id || '|' || tier || '|' || webhook_attempts FROM subscription_payments WHERE reference = '$Reference'"
    if (-not $row) { return $null }
    $p = $row -split "\|"
    [pscustomobject]@{ Status = $p[0]; AmountKobo = [int64]$p[1]; VendorId = $p[2]; Tier = $p[3]; Attempts = [int]$p[4] }
}

function Wait-LedgerStatus([string]$Reference, [string[]]$Wanted, [int]$TimeoutSec) {
    $end = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $end) {
        $l = Get-Ledger $Reference
        if ($l -and ($Wanted -contains $l.Status)) { return $l.Status }
        Start-Sleep -Seconds 3
    }
    "timeout"
}

function Get-DaysUntilExpiry([string]$VendorId, [string]$Since) {
    # expires_at holds UTC wall-clock time (finding F19), so compare against UTC wall-clock now.
    $from = "(now() AT TIME ZONE 'UTC')"
    if ($Since) {
        if ($Since -notmatch '^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(\.\d+)?$') { throw "unexpected timestamp format" }
        $from = "'$Since'::timestamp"
    }
    [double](Invoke-Sql "SELECT round(extract(epoch FROM (expires_at - $from)) / 86400) FROM subscriptions WHERE vendor_id = '$VendorId' AND status = 'active'")
}