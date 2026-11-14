# Graceful stop: ask the local server to save every room and exit.
# Only if that fails, offer to force-stop the recorded pid.
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
$PidPath = Join-Path $DataDir 'server.pid'

if (-not (Test-Path $TokenPath)) {
  Write-Host "没有找到管理令牌（$TokenPath）。服务器可能从未运行过。" -ForegroundColor Yellow
  exit 1
}
$Token = (Get-Content $TokenPath -Raw -Encoding UTF8).Trim()
$ServerPid = $null
if (Test-Path $PidPath) {
  try { $ServerPid = [int]((Get-Content $PidPath -Raw -Encoding UTF8 | ConvertFrom-Json).pid) } catch { $ServerPid = $null }
}

Write-Host "正在请求服务器正常关闭（端口 $Port）..." -ForegroundColor Cyan
$requested = $false
try {
  Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$Port/api/admin/shutdown" `
    -Headers @{ 'X-Admin-Token' = $Token } -TimeoutSec 5 -ContentType 'application/json' -Body '{}' | Out-Null
  $requested = $true
} catch {
  Write-Warning "无法连接服务器：$($_.Exception.Message)"
}

if ($requested) {
  # the server writes rooms, removes the pid file and exits; wait up to 10 s
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 250
    if (-not (Test-Path $PidPath)) { Write-Host "服务器已正常关闭。" -ForegroundColor Green; exit 0 }
  }
  Write-Warning "服务器仍在运行，可能正在保存较大的世界。"
}

if ($ServerPid) {
  $alive = $false
  try { $null = Get-Process -Id $ServerPid -ErrorAction Stop; $alive = $true } catch { $alive = $false }
  if ($alive) {
    $answer = Read-Host "强制结束进程 $ServerPid？未保存的最近改动可能丢失 (y/N)"
    if ($answer -eq 'y' -or $answer -eq 'Y') {
      Stop-Process -Id $ServerPid -Force
      Write-Host "已强制结束进程 $ServerPid。下次启动会尝试从最近备份恢复。" -ForegroundColor Yellow
      exit 0
    }
    Write-Host "已取消；服务器仍在运行。" -ForegroundColor Yellow
    exit 1
  }
}
Write-Host "没有发现正在运行的 OpusMC 服务器。" -ForegroundColor Yellow
exit 1
