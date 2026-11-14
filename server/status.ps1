# Show the local server's health and (with the admin token) room details.
[CmdletBinding()]
param([int]$Port = 0, [string]$Config = '')

$ErrorActionPreference = 'Stop'
$ServerDir = $PSScriptRoot
$ProjectRoot = Split-Path -Parent $ServerDir
$ConfigPath = if ($Config) { $Config } else { Join-Path $ServerDir 'config.json' }
$DataDir = Join-Path $ServerDir 'data'

if (Test-Path $ConfigPath) {
  try {
    $cfg = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cfg.dataDir) { $DataDir = [string]$cfg.dataDir }
    if ($Port -le 0 -and $cfg.port) { $Port = [int]$cfg.port }
  } catch {
    Write-Warning "读取配置失败，使用默认值：$($_.Exception.Message)"
  }
}
if (-not [IO.Path]::IsPathRooted($DataDir)) { $DataDir = Join-Path $ProjectRoot $DataDir }
if ($Port -le 0) { $Port = if ($env:OPUSMC_PORT) { [int]$env:OPUSMC_PORT } else { 8080 } }
$TokenPath = Join-Path $DataDir 'admin-token.txt'

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 4
} catch {
  Write-Host "服务器未运行或无法连接：http://127.0.0.1:$Port/healthz" -ForegroundColor Red
  exit 1
}

Write-Host "OpusMC 自建服务器" -ForegroundColor Cyan
Write-Host ("  名称：{0}" -f $health.name)
Write-Host ("  版本：{0}  运行：{1} 秒" -f $health.version, $health.uptime)
Write-Host ("  房间：{0}/{1}  在线玩家：{2}  连接：{3}" -f $health.rooms, $health.maxRooms, $health.players, $health.connections)

if (Test-Path $TokenPath) {
  $token = (Get-Content $TokenPath -Raw -Encoding UTF8).Trim()
  try {
    $admin = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/admin/status" -Headers @{ 'X-Admin-Token' = $token } -TimeoutSec 4
    if ($admin.perf) {
      $tpsText = if ($null -eq $admin.perf.tps) { '测量中' } else { $admin.perf.tps }
      Write-Host ("  性能：TPS {0}  tick {1}/{2} ms  迟到 {3}  CPU {4}%  RSS {5} MB" -f $tpsText, $admin.perf.tickAvgMs, $admin.perf.tickMaxMs, $admin.perf.lateTicks, $admin.perf.cpuPct, $admin.perf.rssMB) -ForegroundColor DarkGray
    }
    if ($admin.roomsList.Count -eq 0) { Write-Host "  （没有打开的房间）" }
    foreach ($r in $admin.roomsList) {
      Write-Host ""
      Write-Host ("  房间 {0}  {1}  房主 {2}  {3}/{4} 人  方块改动 {5}" -f $r.code, $r.name, $r.owner, $r.online, $r.maxPlayers, $r.blocks) -ForegroundColor Green
      foreach ($p in $r.players) { Write-Host ("    - {0} ({1}){2}" -f $p.name, $p.pid, $(if ($p.owner) { ' [房主]' } else { '' })) }
    }
  } catch {
    Write-Warning "无法读取管理状态：$($_.Exception.Message)"
  }
}
