# //audit/wait-rig.ps1

# Block until the Paystack stub and the backend both answer.
$deadline = (Get-Date).AddMinutes(3)
foreach ($u in 'http://localhost:9099/__stats', 'http://localhost:18081/health') {
  while ($true) {
    try { Invoke-RestMethod $u -TimeoutSec 2 | Out-Null; break } catch {}
    if ((Get-Date) -gt $deadline) { Write-Host "timed out waiting for $u"; exit 1 }
    Start-Sleep 2
  }
}
Write-Host 'rig ready'