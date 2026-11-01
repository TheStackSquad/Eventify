# audit/runner/seed-vendors-api.ps1
# Unified Seeding Script:
# 1. Injects background SQL fixtures for analytics, leaderboards, and rankings.
# 2. Creates and verifies audit matrix login accounts and vendor profiles through the real API.
param(
    [string]$BaseUrl = '',
    [string]$CsrfCookie = 'csrf_token',
    [string]$CsrfHeader = 'X-CSRF-Token'
)

# --- AUTO-DETECT BACKEND PORT IF NOT PROVIDED ---
if (-not $BaseUrl -or $BaseUrl -eq 'http://localhost:8080') {
    $candidatePorts = @()
    if ($env:PORT) { $candidatePorts += $env:PORT }
    if ($env:BACKEND_PORT) { $candidatePorts += $env:BACKEND_PORT }
    
    # Prioritize 8081 (from backend/.env), then fallback to 8080 and 3000
    $candidatePorts += @('8081', '8080', '3000')

    $foundPort = $null
    foreach ($p in $candidatePorts) {
        try {
            $socket = New-Object System.Net.Sockets.TcpClient("127.0.0.1", [int]$p)
            if ($socket.Connected) {
                $socket.Close()
                $foundPort = $p
                break
            }
        } catch {
            # Port not open, try next
        }
    }

    if ($foundPort) {
        $BaseUrl = "http://localhost:$foundPort"
        Write-Host "Auto-detected active backend on port $foundPort ($BaseUrl)" -ForegroundColor Cyan
    } else {
        $BaseUrl = 'http://localhost:8081' # Default fallback matching backend/.env
    }
}

$ErrorActionPreference = 'Stop'

function Short([string]$Text) {
    $t = ($Text -replace '\s+', ' ').Trim()
    if ($t.Length -gt 300) { $t.Substring(0, 300) + '...' } else { $t }
}

function Send([string]$Method, [string]$Path, $Object, [string]$Jar, [string]$Csrf) {
    $out = [IO.Path]::GetTempFileName()
    $inp = $null
    $curl = @('-s', '-o', $out, '-w', '%{http_code}', '-X', $Method, '-H', 'Content-Type: application/json', '-b', $Jar, '-c', $Jar)
    if ($Csrf) { $curl += @('-H', ('{0}: {1}' -f $CsrfHeader, $Csrf)) }
    if ($Object) {
        $inp = [IO.Path]::GetTempFileName()
        [IO.File]::WriteAllText($inp, ($Object | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
        $curl += @('--data-binary', "@$inp")
    }
    $code = (& curl.exe @curl "$BaseUrl$Path") -join ''
    $body = [IO.File]::ReadAllText($out)
    @($out, $inp) | Where-Object { $_ } | ForEach-Object { Remove-Item $_ -ErrorAction SilentlyContinue }
    [pscustomobject]@{ Code = [int]$code; Body = $body }
}

function Get-Csrf([string]$Jar) {
    foreach ($line in Get-Content -LiteralPath $Jar) {
        $f = ($line -replace '^#HttpOnly_', '') -split "`t"
        if ($f.Count -ge 7 -and $f[5] -eq $CsrfCookie) { return $f[6] }
    }
    return $null
}

function Test-Ok($r) { $r.Code -ge 200 -and $r.Code -lt 300 }
function Stop-Seed([string]$What, $r) { throw ('{0}: HTTP {1}. Server said: {2}' -f $What, $r.Code, (Short $r.Body)) }
function Invoke-Login($v, [string]$Jar) { Send 'POST' '/auth/login' @{ email = $v.Email; password = $v.Password } $Jar $null }
function Invoke-Signup($v, [string]$Jar) {
    Send 'POST' '/auth/signup' @{ name = "$($v.First) $($v.Last)"; email = $v.Email; password = $v.Password } $Jar $null
}

# Rig only: remove an old audit account whose stored password the backend rejects.
function Reset-Account([string]$Email) {
    if ($Email -notmatch '^audit_vendor[0-9]*@example\.com$') { throw "Refusing to delete $Email (only audit_vendor*@example.com)" }
    if ($env:AUDIT_DB_URL -notmatch '@(localhost|127\.0\.0\.1)[:/]') { throw 'AUDIT_DB_URL must point at localhost before an account can be reset' }
    $sql = @'
delete from vendors where owner_id in (select id from users where email = '__EMAIL__');
delete from users where email = '__EMAIL__';
do $$ begin
  if exists (select 1 from information_schema.columns where table_name = 'login_attempts' and column_name = 'email') then
    delete from login_attempts where email = '__EMAIL__';
  end if;
end $$;
'@ -replace '__EMAIL__', $Email.Replace("'", "''")
    & psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q -c $sql | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not delete the old $Email account (a foreign key may block it). Wipe the rig volume instead: docker compose -f audit/docker/docker-compose.loadtest.yml down -v" }
    Write-Host "  removed the old $Email account: its stored password was rejected" -ForegroundColor Yellow
}

function New-VendorProfile($v, [string]$Jar) {
    $csrf = Get-Csrf $Jar
    if (-not $csrf) { throw "No $CsrfCookie cookie after login for $($v.Email); check -CsrfCookie against the CSRF middleware" }
   
    $payload = @{
        name          = $v.Store
        category      = $v.Category
        state         = 'Lagos'
        city          = $v.City
        email         = $v.Email
        description   = 'Automated audit test vendor profile'
        phone_number  = $v.Phone
        phoneNumber   = $v.Phone
        vnin          = $v.Vnin
        verified_vnin = $v.Vnin
        verifiedVNIN  = $v.Vnin
        first_name    = $v.First
        firstName     = $v.First
        last_name     = $v.Last
        lastName      = $v.Last
        image_url     = $v.Image
        imageUrl      = $v.Image
    }
   
    $r = Send 'POST' '/api/v1/vendors/register' $payload $Jar $csrf
    if (Test-Ok $r) { Write-Host "  vendor profile created: $($v.Store)" -ForegroundColor Green }
    elseif ($r.Body -match 'exist|already|duplicate') { Write-Host "  vendor profile already exists: $($v.Store)" -ForegroundColor DarkGray }
    else { Stop-Seed "vendor profile for $($v.Store)" $r }
}

function Initialize-Vendor($v) {
    $jar = [IO.Path]::GetTempFileName()
    try {
        $login = Invoke-Login $v $jar
        if ($login.Code -eq 200) { Write-Host "  account works: $($v.Email)" -ForegroundColor DarkGray }
        else {
            $signup = Invoke-Signup $v $jar
            if (-not (Test-Ok $signup)) {
                if ($signup.Body -notmatch 'exist|already|registered|taken|duplicate') { Stop-Seed "signup for $($v.Email)" $signup }
                Reset-Account $v.Email
                $signup = Invoke-Signup $v $jar
                if (-not (Test-Ok $signup)) { Stop-Seed "signup (second try) for $($v.Email)" $signup }
            }
            $login = Invoke-Login $v $jar
            if ($login.Code -ne 200) { Stop-Seed "login for $($v.Email) after signup" $login }
            Write-Host "  account created: $($v.Email)" -ForegroundColor Green
        }
        New-VendorProfile $v $jar
    }
    finally { Remove-Item $jar -ErrorAction SilentlyContinue }
}

# =========================================================================
# PHASE 1: Inject Background SQL Fixtures (Analytics, Rankings & Leaderboards)
# =========================================================================
Write-Host '=== Phase 1: Applying direct SQL background fixtures ===' -ForegroundColor Cyan

if (-not $env:AUDIT_DB_URL) {
    throw "AUDIT_DB_URL environment variable is not set. Cannot run SQL background fixtures."
}

# Auto-start check for PostgreSQL container on port 55432
$dbHost = "127.0.0.1"
$dbPort = 55432
$connected = $false
$maxRetries = 15
$retryCount = 0

while ($retryCount -lt $maxRetries -and -not $connected) {
    try {
        $socket = New-Object System.Net.Sockets.TcpClient($dbHost, $dbPort)
        if ($socket.Connected) {
            $socket.Close()
            $connected = $true
        }
    } catch {
        if ($retryCount -eq 0) {
            Write-Host "Database not reachable on port $dbPort. Auto-starting Docker loadtest database..." -ForegroundColor Yellow
            & docker compose -f audit/docker/docker-compose.loadtest.yml up -d db 2>&1 | Out-Null
        }
        Start-Sleep -Seconds 2
        $retryCount++
        Write-Host "   Waiting for database connection ($retryCount/$maxRetries)..." -ForegroundColor DarkYellow
    }
}

if (-not $connected) {
    throw "Database failed to start or accept connections on port $dbPort."
}

$sqlFixtures = @'
BEGIN;

-- Clean up stale state idempotently
DELETE FROM vendors WHERE id IN ('f5000000-0000-0000-0000-000000000001','f5000000-0000-0000-0000-000000000002','f5000000-0000-0000-0000-000000000003')
   OR email IN ('elite@events.test','tastebud@catering.test','beatmaster@dj.test');
DELETE FROM users WHERE id IN ('e5000000-0000-0000-0000-000000000001','e5000000-0000-0000-0000-000000000002','e5000000-0000-0000-0000-000000000003')
   OR email IN ('elite@events.test','tastebud@catering.test','beatmaster@dj.test');

-- Insert baseline users
INSERT INTO users (id, name, email, password_hash, role, allow_reminder_emails) VALUES
('e5000000-0000-0000-0000-000000000001', 'Elite Events Ltd',   'elite@events.test',       '$2a$10$UcEJZ55WOX/ZZJBm4QnHkOLXQiu3m390CDd0Z.NSuTgmdbZrtmoR6', 'customer', true),
('e5000000-0000-0000-0000-000000000002', 'Taste Bud Catering', 'tastebud@catering.test', '$2a$10$UcEJZ55WOX/ZZJBm4QnHkOLXQiu3m390CDd0Z.NSuTgmdbZrtmoR6', 'customer', true),
('e5000000-0000-0000-0000-000000000003', 'Beat Master DJ',     'beatmaster@dj.test',     '$2a$10$UcEJZ55WOX/ZZJBm4QnHkOLXQiu3m390CDd0Z.NSuTgmdbZrtmoR6', 'customer', true);

-- Insert baseline vendors (PVS scores aligned with formula: 97, 93, 56)
INSERT INTO vendors (id, owner_id, name, category, image_url, status, is_identity_verified, is_business_registered, state, city,
                     phone_number, min_price, pvs_score, review_count, profile_completion, inquiry_count, responded_count,
                     vnin, first_name, middle_name, last_name, description, email, cac_number, is_business_verified, subscription_tier) VALUES
('f5000000-0000-0000-0000-000000000001', 'e5000000-0000-0000-0000-000000000001', 'Elite Events Planning', 'planner', 'https://example.com/elite.jpg', 'active', true, true, 'Lagos', 'Lekki',
  '08011112222', 15000000, 97, 12, 100, 5, 5, 'ZE123456789012AA', 'Ade', 'Babatunde', 'Adeyemi', 'Full-service luxury event planning and management.', 'elite@events.test', 'RC-123456', true, 'free'),
('f5000000-0000-0000-0000-000000000002', 'e5000000-0000-0000-0000-000000000002', 'Taste Bud Kitchen', 'Catering', 'https://example.com/catering.jpg', 'active', true, true, 'Abuja FCT', 'Garki',
  '08033334444', 5000000, 93, 8, 100, 2, 2, 'ZE987654321012BB', 'Chioma', NULL, 'Okafor', 'Exquisite continental and local dishes for all occasions.', 'tastebud@catering.test', 'RC-789012', true, 'free'),
('f5000000-0000-0000-0000-000000000003', 'e5000000-0000-0000-0000-000000000003', 'Beat Master DJ', 'Music', 'https://example.com/dj.jpg', 'active', true, false, 'Lagos', 'Surulere',
  '08055556666', 8000000, 56, 25, 80, 10, 8, 'ZE555555555512CC', 'Tunde', NULL, 'Bakare', 'Live DJ sets and sound for weddings and parties.', 'beatmaster@dj.test', NULL, false, 'free');

COMMIT;
'@

$sqlFixtures | & psql $env:AUDIT_DB_URL -v ON_ERROR_STOP=1 -q
if ($LASTEXITCODE -ne 0) { throw "SQL background fixtures execution failed." }
Write-Host '  background SQL fixtures applied successfully.' -ForegroundColor Green

# =========================================================================
# PHASE 2: API-Driven Seeding (Matrix Login Accounts & Vendor Profiles)
# =========================================================================
Write-Host '=== Phase 2: Seeding audit vendors through the API ===' -ForegroundColor Cyan

$vendors = @(
    @{ Email = $env:AUDIT_VENDOR_EMAIL;  Password = $env:AUDIT_VENDOR_PASSWORD;  First = 'Audit'; Last = 'Vendor1'; Store = 'Audit Vendor Store 1'; Category = 'Catering'; City = 'Ikeja';        Phone = '08000000001'; Vnin = 'ZE900000000001AA'; Image = 'https://example.com/image1.jpg' }
    @{ Email = $env:AUDIT_VENDOR2_EMAIL; Password = $env:AUDIT_VENDOR2_PASSWORD; First = 'Audit'; Last = 'Vendor2'; Store = 'Audit Vendor Store 2'; Category = 'Catering'; City = 'Lagos Island'; Phone = '08000000002'; Vnin = 'ZE900000000002AA'; Image = 'https://example.com/image2.jpg' }
)

foreach ($v in $vendors) {
    if (-not $v.Email -or -not $v.Password) { Write-Host "  skipped a vendor: its email or password variable is not set" -ForegroundColor DarkGray; continue }
    Initialize-Vendor $v
}
Write-Host 'Unified vendor seeding finished successfully.' -ForegroundColor Green