# audit/error/error-helpers.ps1
#
# Step runner with readable failure output. Dot-source it from the main script:
#     . "$AuditDir\error\error-helpers.ps1"
#
# Usage:
#     Invoke-Step -Name "Building Go backend" -Action { ... } -Solution "What to do if it fails"
#     Invoke-Step -Name "Running checks" -Detailed -Action { ... } -Solution "..."
#
#   * Quiet step (default):   [Step 2] Building Go backend... [PASS]
#   * -Detailed step:         the step prints its own lines (check results) between the
#                             header and the closing [DONE]. Use it when the Action writes output.
#   * -Id is optional. Without it the steps are numbered automatically: Step 1, Step 2, ...
#
# On failure it prints the failed step, the exact error text and your solution, then throws so the
# main script's finally block can still clean up (stop the backend, remove temp files).
#
# This file is plain ASCII on purpose. The icons are built from code points so Windows PowerShell 5.1
# does not garble them. If your terminal cannot show emoji, set NO_EMOJI=1 first.

try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$script:StepCounter = 0
$script:StepFailureReported = $false

if ($env:NO_EMOJI) {
    $script:IconFail = "[X]"; $script:IconError = "[?]"; $script:IconFix = "[!]"
}
else {
    $script:IconFail  = [char]::ConvertFromUtf32(0x274C)
    $script:IconError = [char]::ConvertFromUtf32(0x1F50D)
    $script:IconFix   = [char]::ConvertFromUtf32(0x1F4A1)
}

function Get-StepErrorText($ErrorRecord) {
    $msg = ""
    if ($ErrorRecord.Exception -and $ErrorRecord.Exception.Message) { $msg = $ErrorRecord.Exception.Message }
    else { $msg = [string]$ErrorRecord }
    $msg = $msg -replace '^SETUP FAILED:\s*', ''
    $msg.Trim()
}

function Write-StepFailure([string]$Id, [string]$Name, [string]$Message, [string]$Solution, [string]$Where) {
    $line = "=" * 50
    $indent = " " * 15
    $msgText = ($Message -split "\r?\n") -join ("`n" + $indent)
    Write-Host ""
    Write-Host $line -ForegroundColor Red
    Write-Host "$($script:IconFail) FAILED STEP : $Id - $Name" -ForegroundColor Red
    Write-Host "$($script:IconError) EXACT ERROR : $msgText" -ForegroundColor Yellow
    Write-Host "$($script:IconFix) SOLUTION    : $Solution" -ForegroundColor Cyan
    if ($Where) { Write-Host "   RAISED AT   : $Where" -ForegroundColor DarkGray }
    Write-Host $line -ForegroundColor Red
}

function Invoke-Step {
    [CmdletBinding()]
    param(
        [string]$Id = "",
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [Parameter(Mandatory = $true)][string]$Solution,
        [switch]$Detailed
    )

    if (-not $Id) {
        $script:StepCounter++
        $Id = "Step $($script:StepCounter)"
    }

    if ($Detailed) { Write-Host "[$Id] $Name..." -ForegroundColor Cyan }
    else { Write-Host "[$Id] $Name... " -NoNewline }

    try {
        & $Action
    }
    catch {
        $err = $_
        if ($Detailed) { Write-Host "[$Id] $Name... [FAIL]" -ForegroundColor Red }
        else { Write-Host "[FAIL]" -ForegroundColor Red }

        $where = ""
        if ($err.InvocationInfo -and $err.InvocationInfo.ScriptName) {
            $where = "{0}:{1}" -f (Split-Path -Leaf $err.InvocationInfo.ScriptName), $err.InvocationInfo.ScriptLineNumber
        }
        # Stop-Setup is only the thrower; point at the function that called it instead.
        $frames = @(([string]$err.ScriptStackTrace) -split "\r?\n" | Where-Object { $_ -and ($_ -notmatch '^at Stop-Setup') })
        if ($frames.Count -gt 0) { $where = ($frames[0] -replace '^at\s+', '') }
        Write-StepFailure -Id $Id -Name $Name -Message (Get-StepErrorText $err) -Solution $Solution -Where $where

        $script:StepFailureReported = $true
        throw "Step failed: $Id - $Name"
    }

    if ($Detailed) { Write-Host "[$Id] [DONE]" -ForegroundColor Green }
    else { Write-Host "[PASS]" -ForegroundColor Green }
}