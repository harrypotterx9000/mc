param(
  [int]$Port = 8080,
  [string]$RuleName = 'OpusMC LAN server',
  [switch]$Remove,
  [switch]$IncludePublic
)
$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Host 'This script changes Windows Firewall and must run as Administrator.' -ForegroundColor Red
  Write-Host 'Right-click PowerShell -> Run as administrator, then run it again.'
  exit 1
}

if ($Remove) {
  $rules = Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue
  if (-not $rules) { Write-Host "Firewall rule not found: $RuleName"; exit 0 }
  $rules | Remove-NetFirewallRule
  Write-Host "Removed firewall rule: $RuleName"
  exit 0
}

# Private is the safe default. Some home Wi-Fi networks are classified as
# Public by Windows; -IncludePublic allows that explicitly (same Wi-Fi only,
# never use it on a cafe/airport/hotel network).
$profiles = if ($IncludePublic) { 'Private,Public' } else { 'Private' }

Get-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -Action Allow -Protocol TCP `
  -LocalPort $Port -Profile $profiles -Description 'OpusMC LAN multiplayer (same Wi-Fi only)' | Out-Null
Write-Host "Added inbound TCP $Port for profile(s): $profiles"

Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, NetworkCategory | Format-Table -AutoSize
if (-not $IncludePublic) {
  $public = Get-NetConnectionProfile | Where-Object { $_.NetworkCategory -eq 'Public' }
  if ($public) {
    Write-Host 'WARNING: some interfaces are on the Public profile; the rule does not apply there.' -ForegroundColor Yellow
    Write-Host 'For a trusted home Wi-Fi you can either set it to Private in Windows Settings,'
    Write-Host 'or rerun this script with -IncludePublic (do not do that on public Wi-Fi).'
  }
}
Write-Host "Test from a phone on the same Wi-Fi: http://<this-PC-LAN-IP>:$Port/healthz"
