# Move Docker Desktop WSL data from C to D drive
# This script moves docker-desktop-data to D:\DockerWSL to free up C drive space

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Docker Desktop D Drive Migration Tool" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$newDockerPath = "D:\DockerWSL"
$exportPath = "D:\docker-desktop-export.tar"

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host "Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

# Create target directory
Write-Host "1. Creating target directory: $newDockerPath" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $newDockerPath | Out-Null
Write-Host "   Created successfully" -ForegroundColor Green
Write-Host ""

# Check current WSL distros
Write-Host "2. Checking current WSL distributions..." -ForegroundColor Yellow
wsl --list -v
Write-Host ""

# Stop Docker Desktop
Write-Host "3. Stopping Docker Desktop..." -ForegroundColor Yellow
Write-Host "   Please close Docker Desktop if it's running and press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Verify docker-desktop exists
$wslList = wsl --list --quiet
if ($wslList -notcontains "docker-desktop") {
    Write-Host "ERROR: docker-desktop not found!" -ForegroundColor Red
    Write-Host "Current WSL distros:" -ForegroundColor Yellow
    wsl --list
    exit 1
}

# Export docker-desktop
Write-Host ""
Write-Host "4. Exporting docker-desktop (this may take 5-10 minutes)..." -ForegroundColor Yellow
Write-Host "   This includes your 9.6GB of Ollama models and all Docker data" -ForegroundColor Cyan
Write-Host "   Export file: $exportPath" -ForegroundColor Cyan
wsl --export docker-desktop "$exportPath"
Write-Host "   Export completed" -ForegroundColor Green
Write-Host ""

# Check export file size
$exportSize = (Get-Item $exportPath).Length / 1GB
Write-Host "   Export size: $([math]::Round($exportSize, 2)) GB" -ForegroundColor Cyan
Write-Host ""

# Unregister the old distribution
Write-Host "5. Unregistering old docker-desktop from C drive..." -ForegroundColor Yellow
wsl --unregister docker-desktop
Write-Host "   Unregistered successfully" -ForegroundColor Green
Write-Host ""

# Import to new location
Write-Host "6. Importing docker-desktop to D drive..." -ForegroundColor Yellow
Write-Host "   Target: $newDockerPath\docker-desktop" -ForegroundColor Cyan
wsl --import docker-desktop "$newDockerPath\docker-desktop" "$exportPath" --version 2
Write-Host "   Import completed" -ForegroundColor Green
Write-Host ""

# Clean up export file
Write-Host "7. Cleaning up temporary export file..." -ForegroundColor Yellow
Remove-Item $exportPath -Force
Write-Host "   Cleanup completed" -ForegroundColor Green
Write-Host ""

# Verify new setup
Write-Host "8. Verifying new WSL setup..." -ForegroundColor Yellow
wsl --list -v
Write-Host ""

Write-Host "==================================================" -ForegroundColor Green
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Docker data has been moved to: $newDockerPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Start Docker Desktop" -ForegroundColor White
Write-Host "2. Wait for it to initialize (may take 1-2 minutes)" -ForegroundColor White
Write-Host "3. Verify containers are running: docker ps" -ForegroundColor White
Write-Host "4. Test Ollama: docker exec abcc-ollama ollama list" -ForegroundColor White
Write-Host ""
Write-Host "Expected disk space saved on C drive: ~40GB" -ForegroundColor Green
Write-Host ""
