# audit/matrix/setup.ps1
# Everything that has to work before the checks run: rig mode (docker compose), tunnel mode
# (local backend + ngrok), login, vendor lookup and the baseline state.
# Functions that take $Ctx read and write the shared run context created in the main script.

# ---------------------------------------------------------------- rig mode (docker compose)

function Get-PortOwner([int]$Port) {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { return $null }
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    $name = "unknown"
    if ($p) { $name = $p.ProcessName }
    [pscustomobject]@{ Pid = $c.OwningProcess; Name = $name }
}

function Get-PublishedPort($Service, [int]$Target) {
    foreach ($p in @(Get-Prop $Service "ports")) {
        if ($p -and ([int](Get-Prop $p "target") -eq $Target)) { return [int](Get-Prop $p "published") }
    }
    $null
}

function Get-RigConfig {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { Stop-Setup "docker is not on PATH" }
    $file = $ComposeFile
    if (-not [IO.Path]::IsPathRooted($file)) { $file = Join-Path $RepoRoot $file }
    if (-not (Test-Path -LiteralPath $file)) { Stop-Setup "compose file not found: $file" }
    $script:ComposePath = $file

    $json = (& docker compose -f $file config --format json 2>$null | Out-String)
    if (($LASTEXITCODE -ne 0) -or (-not $json.Trim())) { Stop-Setup "'docker compose config' failed for $file. Is Docker running, and is Compose v2 installed?" }
    $cfg = $json | ConvertFrom-Json

    $db = Get-Prop $cfg "services.db"
    $be = Get-Prop $cfg "services.backend"
    if ((-not $db) -or (-not $be)) { Stop-Setup "the compose file must define services named 'db' and 'backend'" }
    $dbEnv = Get-Prop $db "environment"
    $beEnv = Get-Prop $be "environment"

    $dbPort = Get-PublishedPort $db 5432
    $bePort = Get-PublishedPort $be ([int](Get-Prop $beEnv "PORT"))
    if (-not $dbPort) { Stop-Setup "the db service does not publish container port 5432 to the host" }
    if (-not $bePort) { Stop-Setup "the backend service does not publish its PORT to the host" }
    $script:Port = $bePort

    $ports = @()
    foreach ($svc in $cfg.services.PSObject.Properties) {
        foreach ($pp in @(Get-Prop $svc.Value "ports")) {
            if ($pp) { $pub = Get-Prop $pp "published"; if ($pub) { $ports += [int]$pub } }
        }
    }
    $script:RigPorts = $ports

    $user = [uri]::EscapeDataString([string](Get-Prop $dbEnv "POSTGRES_USER"))
    $pass = [uri]::EscapeDataString([string](Get-Prop $dbEnv "POSTGRES_PASSWORD"))
    $name = [string](Get-Prop $dbEnv "POSTGRES_DB")
    $env:AUDIT_DB_URL = "postgres://${user}:${pass}@localhost:${dbPort}/${name}?sslmode=disable"
    $env:PAYSTACK_SECRET_KEY = [string](Get-Prop $beEnv "PAYSTACK_SECRET_KEY")

    if (-not (Get-Prop $beEnv "RSA_PRIVATE_KEY") -or -not (Get-Prop $beEnv "RSA_PUBLIC_KEY")) {
        Stop-Setup "RSA_PRIVATE_KEY / RSA_PUBLIC_KEY are empty in the compose config. Define them in audit\docker\.env or your shell; login cannot work without them."
    }
    $script:RigFrontendUrl = [bool](Get-Prop $beEnv "FRONTEND_URL")
    $script:RunInfo.WorkerInterval = [string](Get-Prop $beEnv "SUBSCRIPTION_WORKER_INTERVAL")

    $base = [string](Get-Prop $beEnv "PAYSTACK_BASE_URL")
    if ($base) {
        $u = [uri]$base
        $stub = Get-Prop $cfg ("services." + $u.Host)
        $stubPort = $null
        if ($stub) { $stubPort = Get-PublishedPort $stub $u.Port }
        if (-not $stubPort) { Stop-Setup "the backend's PAYSTACK_BASE_URL points at '$($u.Host)', which is not a compose service with a published port" }
        $script:RunInfo.StubBase = "http://localhost:$stubPort"
        $script:RunInfo.PaystackMode = "local stub from the compose rig (not real Paystack)"
    }
    Add-Result "S0" "rig settings read from the compose file" "db, backend, signing key, stub" ("db:{0} backend:{1} stub:{2} worker:{3}" -f $dbPort, $bePort, $(if ($RunInfo.StubBase) { $RunInfo.StubBase } else { "none" }), $RunInfo.WorkerInterval) "INFO"
}

function Start-RigStack {
    if ($StartRig) {
        # Fail in seconds, not after a 90 second image build, when another program holds a host port.
        foreach ($p in $RigPorts) {
            $o = Get-PortOwner $p
            if ($o -and ($o.Name -notmatch 'docker|wsl|vpnkit')) {
                Stop-Setup "host port $p, which the rig publishes, is already in use by $($o.Name) (PID $($o.Pid)). Stop that program, or change the left-hand side of that port mapping in the compose file to a free port above 10000. The script reads the published ports from the compose file, so nothing else needs editing."
            }
        }

        Write-Host "[*] docker compose up -d --build (this can take a few minutes)" -ForegroundColor Yellow
        $upLines = @()
        $prev = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try { & docker compose -f $script:ComposePath up -d --build 2>&1 | ForEach-Object { "$_" } | Tee-Object -Variable upLines | Out-Host }
        finally { $ErrorActionPreference = $prev }
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            $text = (@($upLines) -join "`n")
            if ($text -match '(?i)ports are not available|port is already allocated|address already in use|only one usage of each socket address') {
                $port = $null
                if ($text -match '(?:0\.0\.0\.0|127\.0\.0\.1|\[::\]):(\d+)') { $port = [int]$Matches[1] }
                $owner = $null
                if ($port) { $owner = Get-PortOwner $port }
                if ($owner -and ($owner.Name -notmatch 'docker|wsl|vpnkit')) {
                    Stop-Setup "host port $port is already in use by $($owner.Name) (PID $($owner.Pid)). Stop that program, or change the left-hand side of that port mapping in the compose file to a free port above 10000."
                }
                elseif ($owner) {
                    Stop-Setup "host port $port is held through Docker, probably by another container. Find it with: docker ps --format ""table {{.Names}}\t{{.Ports}}"" and stop it, or change the published port in the compose file."
                }
                Stop-Setup "host port $port is reported as taken, but no program is listening on it. This is usually a stale Docker port proxy: run docker compose -f <compose file> down, then retry. If it persists, restart Docker Desktop."
            }
            $tail = (@($upLines) | Select-Object -Last 8) -join "`n"
            Stop-Setup "docker compose up failed (exit code $code). Last lines:`n$tail"
        }
    }
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        try { $null = Invoke-Sql "SELECT 1"; $ready = $true; break } catch { Start-Sleep -Seconds 2 }
    }
    if (-not $ready) { Stop-Setup "the rig database is not reachable. Start the rig with -StartRig (or: docker compose -f <file> up -d)." }
}

function Confirm-Migrations {
    $missing = $false
    $target = $env:AUDIT_DB_URL -replace '://[^@]*@', '://'   # host:port/db, password removed
    try { $null = Invoke-Sql "SELECT 1 FROM subscription_payments LIMIT 1" }
    catch {
        # Only a genuinely missing table counts as "not migrated". Anything else (wrong port, bad
        # password, database down) is a different problem and must show its real error.
        if ($_.Exception.Message -match 'does not exist') { $missing = $true } else { throw }
    }
    if (-not $missing) { return }
    if ($ApplyMigrations) {
        if (-not (Get-Command migrate -ErrorAction SilentlyContinue)) { Stop-Setup "the migrate CLI is not on PATH (go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest)" }
        $m = Invoke-NativeCapture "migrate" @("-path", (Join-Path $BackendDir "migrations"), "-database", $env:AUDIT_DB_URL, "up")
        if ($m.ExitCode -ne 0) { Stop-Setup "migrate up failed (exit code $($m.ExitCode)):`n$($m.Output)" }
        return
    }
    Stop-Setup "subscription_payments does not exist in the database the script checked: $target (migration 000001 not applied there). Re-run with -ApplyMigrations, or recreate the rig database so it is rebuilt from audit\docker\schema.sql."
}

function Wait-Backend {
    for ($i = 0; $i -lt 90; $i++) {
        $r = Invoke-Http -Method GET -Url "$Sub/plans"
        if ($r.Status -eq 200) { return }
        Start-Sleep -Seconds 1
    }
    Stop-Setup "the rig backend did not answer on $BaseUrl within 90 seconds. Try: docker compose -f <file> logs backend"
}

function Wait-Stub {
    if (-not $RunInfo.StubBase) { return }
    for ($i = 0; $i -lt 90; $i++) {
        $r = Invoke-Http -Method GET -Url "$($RunInfo.StubBase)/__health"
        if ($r.Status -eq 200) { return }
        Start-Sleep -Seconds 1
    }
    Stop-Setup "the Paystack stub did not answer on $($RunInfo.StubBase)/__health within 90 seconds. Run: docker compose -f <compose file> logs stub. The stub exits at startup when PAYSTACK_SECRET_KEY is empty on the stub service."
}

function Add-RigFrontendNote {
    if (-not $RigFrontendUrl) {
        Add-Result "S7" "rig defines FRONTEND_URL for the subscription callback" "FRONTEND_URL set" "not set (only FRONTEND_BASE_URL?)" "INFO" "InitiateSubscription reads FRONTEND_URL when building callback_url."
    }
}

# ---------------------------------------------------------------- tunnel mode

function Confirm-LedgerTable {
    try { $null = Invoke-Sql "SELECT 1 FROM subscription_payments LIMIT 1" }
    catch { Stop-Setup "cannot query subscription_payments. Is migration 000001 applied to this database? ($($_.Exception.Message))" }
}

function Start-Backend {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
        if (-not $ReuseBackend) {
            Stop-Setup ("port $Port is already in use by PID {0} ({1}, started {2}). It may be running stale code. Stop it, or pass -ReuseBackend to test it anyway." -f $listener.OwningProcess, $proc.ProcessName, $proc.StartTime)
        }
        $script:RunInfo.BackendReused = $true
        return
    }
    $exe = Join-Path $Tmp "eventify-backend.exe"
    Push-Location $BackendDir
    try {
        $build = Invoke-NativeCapture "go" @("build", "-buildvcs=false", "-o", $exe, ".")
        if ($build.ExitCode -ne 0) { Stop-Setup "go build failed (exit code $($build.ExitCode)):`n$($build.Output)" }
    } finally { Pop-Location }
    $env:PORT = "$Port"
    $p = Start-Process -FilePath $exe -WorkingDirectory $BackendDir -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput (Join-Path $Tmp "backend.out.log") -RedirectStandardError (Join-Path $Tmp "backend.err.log")
    $script:Started += $p
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        if ($p.HasExited) { Stop-Setup "backend exited early; see $Tmp\backend.err.log" }
        $r = Invoke-Http -Method GET -Url "$Sub/plans"
        if ($r.Status -eq 200) { return }
    }
    Stop-Setup "backend did not become ready within 30s on port $Port; see $Tmp\backend.err.log (does it read PORT?)"
}

function Start-Tunnel {
    $api = "http://127.0.0.1:4040/api/tunnels"
    $find = {
        try { (Invoke-RestMethod -Uri $api -TimeoutSec 3).tunnels | Where-Object { $_.config.addr -match ":$Port$" } | Select-Object -First 1 } catch { $null }
    }
    $t = & $find
    if (-not $t) {
        if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) { Stop-Setup "ngrok is not on PATH" }
        foreach ($flag in "--url", "--domain") {
            $p = Start-Process ngrok -ArgumentList @("http", "$Port", "$flag=$NgrokDomain") -PassThru -WindowStyle Hidden
            Start-Sleep -Seconds 4
            if (-not $p.HasExited) { $script:Started += $p; break }
        }
        for ($i = 0; $i -lt 10 -and -not $t; $i++) { Start-Sleep -Seconds 1; $t = & $find }
    }
    if (-not $t) { Stop-Setup "no ngrok tunnel for port $Port. Is ngrok authenticated? Try: ngrok config check" }
    if ($t.public_url -ne $PublicBase) { Stop-Setup "tunnel is $($t.public_url) but the Paystack dashboard webhook expects $PublicBase" }
    $script:RunInfo.Tunnel = $t.public_url
}

# ---------------------------------------------------------------- reachability, login, vendors, baseline

function Test-BackendReachable($Ctx) {
    $reach = Invoke-Http -Method GET -Url "$PublicBase/api/v1/subscription/plans"
    $Ctx.Reach = $reach
    $reachLabel = "backend reachable through the ngrok tunnel"
    if ($Rig) { $reachLabel = "rig backend reachable" }
    Check "S1" $reachLabel "200" "$($reach.Status)" ($reach.Status -eq 200)
    if ($reach.Status -ne 200) { Stop-Setup "the backend is not reachable at $PublicBase (HTTP $($reach.Status))" }
}

function New-VendorSessions($Ctx) {
    $s1 = New-Session $env:AUDIT_VENDOR_EMAIL $env:AUDIT_VENDOR_PASSWORD "vendor1"
    $me = Invoke-Auth $s1 GET "/me"
    Check "S2" "vendor 1 session works" "200 on /me" "$($me.Status)" ($me.Status -eq 200)
    if ($me.Status -ne 200) { Stop-Setup "the session is not accepted by /me (HTTP $($me.Status))" }
    $csrfNote = "present"
    if (-not $s1.Csrf) { $csrfNote = "NOT FOUND; -CsrfCookie may be wrong, POSTs may be rejected" }
    Add-Result "S3" "CSRF cookie after login" "present" $csrfNote "INFO"

    $Ctx.S1 = $s1
    $Ctx.S2 = $null
    if ($env:AUDIT_VENDOR2_EMAIL -and $env:AUDIT_VENDOR2_PASSWORD) {
        $Ctx.S2 = New-Session $env:AUDIT_VENDOR2_EMAIL $env:AUDIT_VENDOR2_PASSWORD "vendor2"
    }
}

function Resolve-Vendors($Ctx) {
    $vid = Get-VendorId $env:AUDIT_VENDOR_EMAIL
    if ($vid -notmatch '^[0-9a-fA-F-]{36}$') { Stop-Setup "no vendor is owned by AUDIT_VENDOR_EMAIL in this database" }
    if ($Ctx.S2) {
        $vid2 = Get-VendorId $env:AUDIT_VENDOR2_EMAIL
        if ($vid2 -eq $vid) { Stop-Setup "vendor 2 must own a different vendor than vendor 1" }
    }
    $Ctx.Vid = $vid
}

function Get-BaselineState($Ctx) {
    $vid = $Ctx.Vid
    $activeTier = Invoke-Sql "SELECT coalesce(max(tier), '') FROM subscriptions WHERE vendor_id = '$vid' AND status = 'active'"
    $Ctx.UseTier = "premium"
    if ($activeTier) {
        $Ctx.UseTier = $activeTier
        Add-Result "S4" "vendor 1 already has an active plan" "none (cleanest evidence)" $activeTier "INFO" "Tests assert 'no change' instead of 'no active row'."
    }

    if ($RunInfo.StubBase) {
        $probe = Get-StubVerify ([guid]::NewGuid().ToString())
        $probeStatus = [string](Get-Prop $probe.Json "data.status")
        $o5 = "INFO"
        if ($probeStatus -eq "success") { $o5 = "FAIL" }
        Add-Result "S5" "stub verify for a reference nobody paid" "anything except 'success'" "HTTP $($probe.Status), data.status='$probeStatus'" $o5
    }
}