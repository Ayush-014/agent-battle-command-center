# Create safety backup before Docker migration
# This creates a backup of critical Docker data for rollback if needed

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Docker Safety Backup Tool" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$backupDir = "D:\docker-migration-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$volumeBackup = "$backupDir\volumes"

Write-Host "Creating safety backup before migration..." -ForegroundColor Yellow
Write-Host "Backup location: $backupDir" -ForegroundColor Cyan
Write-Host ""

# Create backup directory
New-Item -ItemType Directory -Force -Path $volumeBackup | Out-Null

# Backup critical volumes using Docker
Write-Host "Backing up Docker volumes..." -ForegroundColor Yellow

# Backup Ollama models list and workspace
docker run --rm -v agent-battle-command-center_ollama_data:/data -v ${backupDir}:/backup alpine tar czf /backup/ollama-data-backup.tar.gz -C /data .
docker run --rm -v agent-battle-command-center_postgres_data:/data -v ${backupDir}:/backup alpine tar czf /backup/postgres-data-backup.tar.gz -C /data .
docker run --rm -v agent-battle-command-center_backup_data:/data -v ${backupDir}:/backup alpine tar czf /backup/backup-data-backup.tar.gz -C /data .

Write-Host "   Ollama data backed up" -ForegroundColor Green
Write-Host "   PostgreSQL data backed up" -ForegroundColor Green
Write-Host "   Backup data backed up" -ForegroundColor Green
Write-Host ""

# Save Docker Compose state
Write-Host "Saving Docker Compose configuration..." -ForegroundColor Yellow
Copy-Item "D:\dev\agent-battle-command-center\docker-compose.yml" "$backupDir\docker-compose.yml"
Copy-Item "D:\dev\agent-battle-command-center\.env" "$backupDir\.env" -ErrorAction SilentlyContinue

# Save list of running containers
docker ps -a --format "{{.Names}},{{.Image}},{{.Status}}" | Out-File "$backupDir\containers-list.txt"
docker volume ls --format "{{.Name}},{{.Driver}}" | Out-File "$backupDir\volumes-list.txt"
docker images --format "{{.Repository}}:{{.Tag}},{{.Size}}" | Out-File "$backupDir\images-list.txt"

Write-Host "   Configuration saved" -ForegroundColor Green
Write-Host ""

# Calculate backup size
$backupSize = (Get-ChildItem $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB
Write-Host "==================================================" -ForegroundColor Green
Write-Host "Backup Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backup location: $backupDir" -ForegroundColor Cyan
Write-Host "Backup size: $([math]::Round($backupSize, 2)) GB" -ForegroundColor Cyan
Write-Host ""
Write-Host "This backup can be used to restore if migration fails." -ForegroundColor Yellow
Write-Host "Keep this backup until you verify Docker works after migration." -ForegroundColor Yellow
Write-Host ""
Write-Host "Ready to proceed with migration!" -ForegroundColor Green
Write-Host ""
