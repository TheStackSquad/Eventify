# audit/matrix/report.ps1
# Writes the evidence report (markdown + json) to audit\results\.

function Write-Report {
    $utc = (Get-Date).ToUniversalTime()
    $stamp = $utc.ToString("yyyyMMdd-HHmmss")
    $sha = ((& git -C $RepoRoot rev-parse --short HEAD 2>$null) | Out-String).Trim()
    $dirty = @(& git -C $RepoRoot status --porcelain 2>$null).Count
    if (-not (Test-Path $ResultsDir)) { New-Item -ItemType Directory -Path $ResultsDir | Out-Null }
    $md = { param($s) ([string]$s).Replace("|", "/").Replace("`r", " ").Replace("`n", " ") }

    $claims = @(
        @{ Text = "An initiated but unpaid payment cannot activate or extend a subscription through the verify endpoint."; Needs = @("T9.4", "T9.5") },
        @{ Text = "A correctly signed webhook that claims success for an unpaid transaction is acknowledged but changes nothing: the server re-verifies with the gateway and does not trust the payload."; Needs = @("T9b.1", "T9b.2") },
        @{ Text = "Webhooks with a wrong, missing or mismatched signature are rejected with 401 and cause no state change."; Needs = @("T3.1", "T3.2", "T3.3") },
        @{ Text = "A signed webhook for an unknown reference is acknowledged and has no side effects."; Needs = @("T3c.1") },
        @{ Text = "The public plans endpoint matches the server price table (one source of truth)."; Needs = @("T13.1") },
        @{ Text = "Free, unknown and malformed tiers are rejected before any payment record is written."; Needs = @("T10.1") },
        @{ Text = "The paying vendor always comes from the session, never from the request body."; Needs = @("T10.2") },
        @{ Text = "A vendor cannot verify another vendor's payment."; Needs = @("T8.1") },
        @{ Text = "Hostile reference strings produce 4xx responses, never 5xx."; Needs = @("T17.1") },
        @{ Text = "Initiate and verify require an authenticated session, and initiate also requires a CSRF token."; Needs = @("T12.1", "T12.2", "T12.3") },
        @{ Text = "A real Paystack test payment activates the subscription once, and Paystack's webhook reaches the backend through the tunnel."; Needs = @("T1.1", "T1.2", "T1.3", "T1.4") },
        @{ Text = "Re-delivered signed webhooks do not extend or duplicate the subscription."; Needs = @("T2.1", "T2.2") },
        @{ Text = "A vendor with an active plan cannot start a payment for a different tier."; Needs = @("T7.1") },
        @{ Text = "An amount mismatch parks the payment for manual review and leaves the subscription untouched."; Needs = @("T5.1", "T5.2", "T5.3") }
    )
    $passed = @($Results | Where-Object { $_.Outcome -eq "PASS" } | ForEach-Object { $_.Id })
    $supported = @(); $unsupported = @()
    $suffix = ""
    if ($Rig) { $suffix = " (demonstrated against the local Paystack stub)" }
    foreach ($c in $claims) {
        $missing = @($c.Needs | Where-Object { $passed -notcontains $_ })
        if ($missing.Count -eq 0) { $supported += ($c.Text + $suffix) } else { $unsupported += ("{0} (needs: {1})" -f $c.Text, ($missing -join ", ")) }
    }

    $next = @()
    foreach ($o in "FAIL", "SKIP", "INFO") {
        foreach ($r in @($Results | Where-Object { $_.Outcome -eq $o })) {
            if ($Hints.ContainsKey($r.Id)) { $next += ("- **{0} [{1}]** {2}: {3}" -f $r.Id, $o, (& $md $r.Name), $Hints[$r.Id]) }
            elseif ($o -eq "SKIP") { $next += ("- **{0} [SKIP]** {1}: {2}" -f $r.Id, (& $md $r.Name), (& $md $r.Note)) }
        }
    }

    $backendNote = "built from the working tree by this script"
    if ($Rig) { $backendNote = "docker rig backend container" }
    elseif ($RunInfo.BackendReused) { $backendNote = "an already-running process (-ReuseBackend); code version not verified" }
    $modeNote = "tunnel mode, automated only"
    if ($Rig) { $modeNote = "rig mode (compose file: $(Split-Path -Leaf $ComposePath))" }
    elseif ($RunInfo.Manual) { $modeNote = "tunnel mode, automated + manual payment tests" }
    $tunnelNote = $RunInfo.Tunnel
    if ($Rig) { $tunnelNote = "none (local rig)" }

    $L = New-Object System.Collections.Generic.List[string]
    $L.Add("# Subscription matrix evidence")
    $L.Add("")
    $L.Add("| Item | Value |")
    $L.Add("|---|---|")
    $L.Add("| Run (UTC) | $($utc.ToString('yyyy-MM-dd HH:mm:ss')) |")
    $L.Add("| Git commit | $sha ($dirty uncommitted paths in the repo) |")
    $L.Add("| Mode | $modeNote |")
    $L.Add("| Backend | $backendNote |")
    $L.Add("| Tunnel host | $tunnelNote |")
    $L.Add("| Paystack | $($RunInfo.PaystackMode); key prefix verified, key not recorded |")
    $L.Add("")
    $L.Add("## Results")
    $L.Add("")
    $L.Add("| ID | Check | Expected | Got | Result |")
    $L.Add("|---|---|---|---|---|")
    foreach ($r in $Results) { $L.Add("| $($r.Id) | $(& $md $r.Name) | $(& $md $r.Expected) | $(& $md $r.Actual) | **$($r.Outcome)** |") }
    $L.Add("")
    $L.Add("## Next steps (where to look)")
    $L.Add("")
    if ($next.Count -eq 0) { $L.Add("Nothing failed or was skipped with a known follow-up.") } else { foreach ($n in $next) { $L.Add($n) } }
    $L.Add("")
    $L.Add("## Claims supported by this run")
    $L.Add("")
    if ($supported.Count -eq 0) { $L.Add("None.") } else { foreach ($s in $supported) { $L.Add("- $s") } }
    $L.Add("")
    $L.Add("## Not demonstrated in this run")
    $L.Add("")
    if ($unsupported.Count -eq 0) { $L.Add("None.") } else { foreach ($u in $unsupported) { $L.Add("- $u") } }
    $L.Add("")
    $L.Add("## Limits of this evidence")
    $L.Add("")
    $L.Add("- One backend process on one machine. Multi-instance behaviour is not exercised.")
    if ($Rig) { $L.Add("- Paystack's behaviour is simulated by the rig's stub. Claims about Paystack itself need a test-mode run (tunnel mode).") }
    else { $L.Add("- Paystack test mode and one payment channel. Live mode and other channels may behave differently.") }
    $L.Add("- Concurrency is proven at repository level by the Go integration tests, not through HTTP here.")
    if (-not $Rig) { $L.Add("- The webhook URL saved in the Paystack dashboard cannot be read by this script; T1.2 confirms it indirectly.") }
    $L.Add("- Expiry, time zone and reminder behaviour (milestone M6) and browser behaviour (M8) are not covered.")
    $L.Add("- Lost-webhook reconciliation (T4) and transient database failure (T6) remain manual procedures.")

    $mdPath = Join-Path $ResultsDir "subscription-matrix-$stamp.md"
    $jsonPath = Join-Path $ResultsDir "subscription-matrix-$stamp.json"
    Set-Content -LiteralPath $mdPath -Value $L -Encoding UTF8
    $Results | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
    Write-Host "`nEvidence written to:`n  $mdPath`n  $jsonPath" -ForegroundColor Cyan
}