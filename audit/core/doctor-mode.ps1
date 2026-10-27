# audit/core/doctor-mode.ps1

# core/doctor-mode.ps1 : mode-specific checks. Rig: docker, compose, ports, health, database. Tunnel: keys, ngrok.
function Test-DockerDaemon {
    $v = docker info --format '{{.ServerVersion}}' 2>$null
    $ok = ($LASTEXITCODE -eq 0 -and $v)
    Add-Check 'Docker' 'daemon' $(if ($ok) { 'PASS' } else { 'FAIL' }) $(if ($ok) { "server $v" } else { 'not reachable' }) 'start Docker Desktop and wait until it says running'
    return [bool]$ok
}

function Test-ComposeServices($Cfg) {
    $names = @($Cfg.services.PSObject.Properties | ForEach-Object { $_.Name })
    foreach ($s in 'db', 'stub', 'mailpit', 'backend') {
        Add-Check 'Compose' "service $s" $(if ($names -contains $s) { 'PASS' } else { 'FAIL' }) '' "the compose file no longer defines '$s'; restore it from git"
    }
    $have = Get-EnvKeys $Cfg 'backend'
    $need = 'POSTGRES_URI', 'PAYSTACK_SECRET_KEY', 'PAYSTACK_BASE_URL', 'SMTP_HOST', 'SMTP_PORT', 'FROM_EMAIL', 'RSA_PRIVATE_KEY', 'RSA_PUBLIC_KEY', 'FRONTEND_BASE_URL'
    $missing = @($need | Where-Object { $_ -notin $have })
    Add-Check 'Compose' 'backend env' $(if ($missing) { 'FAIL' } else { 'PASS' }) $(if ($missing) { 'missing: ' + ($missing -join ', ') } else { 'all required keys set' }) 'add them to the backend service (the RSA keys come from audit/docker/.env)'
    if ('FRONTEND_URL' -notin $have) {
        Add-Check 'Compose' 'FRONTEND_URL' 'WARN' 'not set: the subscription callback URL is relative (finding S7)' 'set it to the FRONTEND_BASE_URL value until the backend uses one name'
    }
    $a = $Cfg.services.stub.environment.PAYSTACK_SECRET_KEY
    $same = $a -and ($a -eq $Cfg.services.backend.environment.PAYSTACK_SECRET_KEY)
    Add-Check 'Compose' 'stub key' $(if ($same) { 'PASS' } else { 'FAIL' }) $(if ($same) { 'stub and backend share one Paystack key' } else { 'the stub needs the backend''s PAYSTACK_SECRET_KEY' }) 'add PAYSTACK_SECRET_KEY to the stub service'
}

function Test-RigPorts($Cfg, [bool]$Running) {
    foreach ($p in Get-StackPorts $Cfg) {
        $name = "$($p.Service):$($p.Port)"
        if ($Running) { Add-Check 'Ports' $name 'SKIP' 'rig is running (the port is its own)' ''; continue }
        if (Test-PortFree $p.Port) { Add-Check 'Ports' $name 'PASS' 'free' '' }
        else { Add-Check 'Ports' $name 'FAIL' ('in use by ' + (Get-PortOwner $p.Port)) 'stop that process (a native backend or air?) or change the port' }
    }
}

function Test-RigHealth($Cfg) {
    $ports = @(Get-StackPorts $Cfg)
    $probes = @(
        @{ Svc = 'backend'; Target = 8081; Path = '/health' }
        @{ Svc = 'stub'; Target = 9099; Path = '/__health' }
        @{ Svc = 'mailpit'; Target = 8025; Path = '/api/v1/messages' }
    )
    foreach ($pr in $probes) {
        $hit = $ports | Where-Object { $_.Service -eq $pr.Svc -and $_.Target -eq $pr.Target } | Select-Object -First 1
        if (-not $hit) { Add-Check 'Health' $pr.Svc 'FAIL' "no published port for $($pr.Target)" 'publish it in the compose file'; continue }
        $url = "http://localhost:$($hit.Port)$($pr.Path)"
        try { Invoke-RestMethod -Uri $url -TimeoutSec 3 | Out-Null; Add-Check 'Health' $pr.Svc 'PASS' $url '' }
        catch { Add-Check 'Health' $pr.Svc 'FAIL' "$url did not answer" "docker compose logs $($pr.Svc)" }
    }
}

function Test-RigDatabase([string]$Compose, $Cfg) {
    $dbEnv = $Cfg.services.db.environment
    $psql = @('compose', '-f', $Compose, 'exec', '-T', 'db', 'psql', '-U', "$($dbEnv.POSTGRES_USER)", '-d', "$($dbEnv.POSTGRES_DB)", '-At', '-c')
    $has = docker @psql "select to_regclass('public.subscription_payments') is not null" 2>$null
    Add-Check 'Database' 'migrations' $(if ($has -eq 't') { 'PASS' } else { 'FAIL' }) $(if ($has -eq 't') { 'subscription_payments exists' } else { 'subscription_payments is missing' }) 'run -Up (it applies the migrations)'
    foreach ($n in 'AUDIT_VENDOR_EMAIL', 'AUDIT_VENDOR2_EMAIL') {
        $mail = Get-Setting $n
        if (-not $mail) { continue }
        $found = docker @psql ("select count(*) from users where email = '" + $mail.Replace("'", "''") + "'") 2>$null
        Add-Check 'Database' $n $(if ($found -eq '1') { 'PASS' } else { 'FAIL' }) $(if ($found -eq '1') { 'account exists in the rig database' } else { 'no such account in the rig database' }) 'apply the vendor seed (update-vendor*.sql); -Up will do this itself from P2'
    }
}

function Test-Rig([string]$Compose) {
    if (-not (Test-DockerDaemon)) { return }
    $cfg = Get-ComposeConfig $Compose
    if (-not $cfg) { Add-Check 'Compose' 'config' 'FAIL' 'docker compose config failed' "run: docker compose -f $Compose config"; return }
    Test-ComposeServices $cfg
    $running = Test-StackRunning $Compose
    Test-RigPorts $cfg $running
    if ($running) { Test-RigHealth $cfg; Test-RigDatabase $Compose $cfg }
    else { Add-Check 'Health' 'stack' 'SKIP' 'the rig is not running yet (use -Up)' '' }
}

function Test-Tunnel {
    $key = Get-Setting 'PAYSTACK_SECRET_KEY'
    if (-not $key) { Add-Check 'Tunnel' 'PAYSTACK_SECRET_KEY' 'FAIL' 'not set' 'use a Paystack TEST secret key (sk_test_...)' }
    elseif ($key -notmatch '^sk_test_') { Add-Check 'Tunnel' 'PAYSTACK_SECRET_KEY' 'FAIL' 'is not a test key' 'only sk_test_ keys are allowed' }
    else { Add-Check 'Tunnel' 'PAYSTACK_SECRET_KEY' 'PASS' 'test key' '' }
    $db = Get-Setting 'AUDIT_DB_URL'
    if (-not $db) { Add-Check 'Tunnel' 'AUDIT_DB_URL' 'FAIL' 'not set' 'postgres://user:pass@localhost:5432/dbname' }
    elseif ($db -notmatch '@(localhost|127\.0\.0\.1)[:/]') { Add-Check 'Tunnel' 'AUDIT_DB_URL' 'FAIL' 'does not point at localhost' 'tunnel runs write test data: use a local database' }
    else { Add-Check 'Tunnel' 'AUDIT_DB_URL' 'PASS' 'localhost' '' }
    if (Get-Command ngrok -ErrorAction SilentlyContinue) {
        ngrok config check 2>&1 | Out-Null
        Add-Check 'Tunnel' 'ngrok config' $(if ($LASTEXITCODE -eq 0) { 'PASS' } else { 'FAIL' }) '' 'run: ngrok config add-authtoken <token>'
    }
    Add-Check 'Tunnel' 'webhook URL' 'SKIP' 'reminder: the Paystack TEST webhook URL is shared; point it at the tunnel for -Manual runs, restore it afterwards' ''
}