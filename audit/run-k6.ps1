# //audit/run-k6.ps1

param([string]$Script = 'mixed', [string]$Profile = 'smoke', [string[]]$Extra = @())
$root = Split-Path $PSScriptRoot -Parent
New-Item -ItemType Directory -Force "$root\audit\results" | Out-Null
$e = @('-e', "PROFILE=$Profile")
foreach ($x in $Extra) { $e += @('-e', $x) }
Push-Location $root
k6 run @e "audit\k6\$Script.js"
Pop-Location