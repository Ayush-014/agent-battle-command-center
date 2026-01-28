#!/bin/bash
# Simple scheduler for backup tasks
# Runs backups every BACKUP_INTERVAL_MINUTES (default: 30)

BACKUP_INTERVAL_MINUTES="${BACKUP_INTERVAL_MINUTES:-30}"
BACKUP_INTERVAL_SECONDS=$((BACKUP_INTERVAL_MINUTES * 60))

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SCHEDULER: $1"
}

log "Starting backup scheduler"
log "Backup interval: ${BACKUP_INTERVAL_MINUTES} minutes (${BACKUP_INTERVAL_SECONDS} seconds)"
log "Retention: ${RETENTION_DAYS:-60} days"

# Run initial backup on startup (after a short delay to let services stabilize)
log "Waiting 30 seconds before initial backup..."
sleep 30

log "Running initial backup..."
/app/scripts/backup.sh
/app/scripts/verify.sh

log "Initial backup complete. Entering scheduled loop..."

# Main scheduling loop
while true; do
    log "Sleeping for ${BACKUP_INTERVAL_MINUTES} minutes..."
    sleep ${BACKUP_INTERVAL_SECONDS}

    log "Running scheduled backup..."
    /app/scripts/backup.sh

    log "Running verification..."
    /app/scripts/verify.sh

    log "Scheduled backup cycle complete."
done
