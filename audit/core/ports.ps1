# audit/core/ports.ps1

# core/ports.ps1 : is a TCP port free, and if not, who holds it.
function Test-PortFree([int]$Port) {
    try {
        $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $l.Start(); $l.Stop(); return $true
    }
    catch { return $false }
}

function Get-PortOwner([int]$Port) {
    if (-not $IsWindows) { return 'unknown (try: ss -ltnp)' }
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $c) { return 'unknown' }
    $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    return ('{0} (pid {1})' -f $(if ($p) { $p.ProcessName } else { '?' }), $c.OwningProcess)
}