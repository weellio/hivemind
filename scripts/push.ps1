# Push an agent lifecycle event to the bridge so the dashboard renders it live.
#   scripts\push.ps1 -id parser -name Parser -state spawning
#   scripts\push.ps1 -id parser -state coding -log "writing parser.js..."
#   scripts\push.ps1 -id parser -remove
param(
  [Parameter(Mandatory=$true)][string]$id,
  [string]$name,
  [string]$state,
  [string]$detail,
  [string]$log,
  [string]$parent,
  [string]$shirt,
  [switch]$remove,
  [int]$port = 3131
)

$payload = @{ agentId = $id }
if ($name)   { $payload.name     = $name }
if ($state)  { $payload.state    = $state }
if ($detail) { $payload.detail   = $detail }
if ($log)    { $payload.log      = $log }
if ($parent) { $payload.parentId = $parent }
if ($shirt)  { $payload.shirt    = $shirt }
if ($remove) { $payload.remove   = $true }

$body = $payload | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Uri "http://localhost:$port/api/event" -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 4 | Out-Null
  Write-Output "ok: $id$(if($state){" -> $state"})"
} catch {
  Write-Output "ERR: $($_.Exception.Message)"
}
