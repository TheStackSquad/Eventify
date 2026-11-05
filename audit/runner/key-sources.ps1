# audit/runner/key-sources.ps1

# Shows where PAYSTACK_SECRET_KEY comes from (prefix and last 4 only) and whether Paystack accepts it.
function Mask([string]$k) { if (-not $k) { '(none)' } else { '{0}...{1}' -f $k.Substring(0, [Math]::Min(8, $k.Length)), $k.Substring([Math]::Max(0, $k.Length - 4)) } }
function Get-FileKey([string]$Path) {
    if (-not (Test-Path $Path)) { return $null }
    $m = Select-String -Path $Path -Pattern '^\s*(?:export\s+)?PAYSTACK_SECRET_KEY\s*=\s*(.+?)\s*$' | Select-Object -First 1
    if ($m) { $m.Matches[0].Groups[1].Value.Trim('"', "'") }
}
function Test-Key([string]$k) {
    if (-not $k) { return 'n/a' }
    $code = curl.exe -s -o NUL -w '%{http_code}' -H "Authorization: Bearer $k" https://api.paystack.co/balance
    if ($code -eq '200') { 'accepted' } elseif ($code -eq '401') { 'REJECTED' } else { "HTTP $code" }
}
$sources = [ordered]@{
    'this shell ($env:)'       = $env:PAYSTACK_SECRET_KEY
    'Windows user variable'    = [Environment]::GetEnvironmentVariable('PAYSTACK_SECRET_KEY', 'User')
    'Windows machine variable' = [Environment]::GetEnvironmentVariable('PAYSTACK_SECRET_KEY', 'Machine')
    'audit/docker/.env'        = Get-FileKey 'audit/docker/.env'
    'backend/.env'             = Get-FileKey 'backend/.env'
    '.env (repo root)'         = Get-FileKey '.env'
}
foreach ($s in $sources.GetEnumerator()) { '{0,-26} {1,-18} {2}' -f $s.Key, (Mask $s.Value), (Test-Key $s.Value) }