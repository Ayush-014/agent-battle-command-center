#!/bin/bash
set -e

# Configuration
BACKUP_BASE="/backups/daily"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${BACKUP_BASE}/${TIMESTAMP}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Database config
PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-abcc}"
export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

# Ollama config
OLLAMA_HOST="${OLLAMA_HOST:-ollama}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${BACKUP_DIR}/backup.log"
}

log "Starting backup to ${BACKUP_DIR}"

# Track backup stats
BACKUP_START=$(date +%s)
declare -A SIZES

#######################################
# 1. PostgreSQL Database Backup
#######################################
log "Backing up PostgreSQL database..."
if pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB}" | gzip > "${BACKUP_DIR}/postgres.sql.gz"; then
    SIZES[postgres]=$(stat -f%z "${BACKUP_DIR}/postgres.sql.gz" 2>/dev/null || stat -c%s "${BACKUP_DIR}/postgres.sql.gz")
    log "PostgreSQL backup complete: ${SIZES[postgres]} bytes"
else
    log "ERROR: PostgreSQL backup failed!"
    exit 1
fi

#######################################
# 2. Workspace Backup
#######################################
log "Backing up workspace..."
if [ -d "/workspace" ]; then
    if tar -czf "${BACKUP_DIR}/workspace.tar.gz" -C / workspace 2>/dev/null; then
        SIZES[workspace]=$(stat -f%z "${BACKUP_DIR}/workspace.tar.gz" 2>/dev/null || stat -c%s "${BACKUP_DIR}/workspace.tar.gz")
        log "Workspace backup complete: ${SIZES[workspace]} bytes"
    else
        log "WARNING: Workspace backup failed or empty"
        SIZES[workspace]=0
    fi
else
    log "WARNING: Workspace directory not found"
    SIZES[workspace]=0
fi

#######################################
# 3. Ollama Models List
#######################################
log "Capturing Ollama models list..."
if curl -s "http://${OLLAMA_HOST}:${OLLAMA_PORT}/api/tags" | jq -r '.models[].name' > "${BACKUP_DIR}/ollama-models.txt" 2>/dev/null; then
    MODEL_COUNT=$(wc -l < "${BACKUP_DIR}/ollama-models.txt" | tr -d ' ')
    SIZES[ollama]=$(stat -f%z "${BACKUP_DIR}/ollama-models.txt" 2>/dev/null || stat -c%s "${BACKUP_DIR}/ollama-models.txt")
    log "Ollama models list captured: ${MODEL_COUNT} models"
else
    log "WARNING: Could not reach Ollama API"
    echo "# Ollama was unreachable during backup" > "${BACKUP_DIR}/ollama-models.txt"
    SIZES[ollama]=0
fi

#######################################
# 4. Environment File (Encrypted)
#######################################
if [ -f "/env-source/.env" ]; then
    if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
        log "Encrypting .env file..."
        if openssl enc -aes-256-cbc -salt -pbkdf2 -in "/env-source/.env" -out "${BACKUP_DIR}/env.enc" -pass "pass:${BACKUP_ENCRYPTION_KEY}"; then
            SIZES[env]=$(stat -f%z "${BACKUP_DIR}/env.enc" 2>/dev/null || stat -c%s "${BACKUP_DIR}/env.enc")
            log ".env encrypted: ${SIZES[env]} bytes"
        else
            log "WARNING: .env encryption failed"
            SIZES[env]=0
        fi
    else
        log "NOTICE: BACKUP_ENCRYPTION_KEY not set, skipping .env backup"
        SIZES[env]=0
    fi
else
    log "NOTICE: No .env file found at /env-source/.env"
    SIZES[env]=0
fi

#######################################
# 5. Generate Checksums
#######################################
log "Generating checksums..."
cd "${BACKUP_DIR}"
sha256sum *.gz *.txt *.enc 2>/dev/null | tee checksums.sha256 > /dev/null
log "Checksums generated"

#######################################
# 6. Generate Manifest
#######################################
BACKUP_END=$(date +%s)
DURATION=$((BACKUP_END - BACKUP_START))
TOTAL_SIZE=$((${SIZES[postgres]:-0} + ${SIZES[workspace]:-0} + ${SIZES[ollama]:-0} + ${SIZES[env]:-0}))

cat > "${BACKUP_DIR}/manifest.json" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "iso_time": "$(date -Iseconds)",
  "duration_seconds": ${DURATION},
  "retention_days": ${RETENTION_DAYS},
  "components": {
    "postgres": {
      "file": "postgres.sql.gz",
      "size_bytes": ${SIZES[postgres]:-0},
      "host": "${PG_HOST}",
      "database": "${PG_DB}"
    },
    "workspace": {
      "file": "workspace.tar.gz",
      "size_bytes": ${SIZES[workspace]:-0}
    },
    "ollama": {
      "file": "ollama-models.txt",
      "size_bytes": ${SIZES[ollama]:-0},
      "host": "${OLLAMA_HOST}"
    },
    "env": {
      "file": "env.enc",
      "size_bytes": ${SIZES[env]:-0},
      "encrypted": $([ -n "${BACKUP_ENCRYPTION_KEY}" ] && echo "true" || echo "false")
    }
  },
  "total_size_bytes": ${TOTAL_SIZE},
  "hostname": "$(hostname)"
}
EOF
log "Manifest generated"

#######################################
# 7. Update Latest Symlink
#######################################
rm -f "${BACKUP_BASE}/latest"
ln -s "${TIMESTAMP}" "${BACKUP_BASE}/latest"
log "Updated 'latest' symlink"

#######################################
# 8. Mirror to Secondary Backup Location
#######################################
if [ -d "/backups-mirror" ]; then
    log "Mirroring backup to secondary location..."
    MIRROR_DIR="/backups-mirror/daily/${TIMESTAMP}"
    mkdir -p "${MIRROR_DIR}"

    if cp -r "${BACKUP_DIR}"/* "${MIRROR_DIR}/" 2>/dev/null; then
        log "Backup mirrored to: ${MIRROR_DIR}"

        # Update latest symlink in mirror
        rm -f "/backups-mirror/daily/latest"
        ln -s "${TIMESTAMP}" "/backups-mirror/daily/latest"
        log "Mirror 'latest' symlink updated"
    else
        log "WARNING: Failed to mirror backup to secondary location"
    fi
else
    log "NOTICE: Secondary backup location not mounted at /backups-mirror"
fi

#######################################
# 9. Cleanup Old Backups
#######################################
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED_COUNT=0

# Calculate cutoff date (works on both GNU and BusyBox date)
CUTOFF_SECONDS=$(($(date +%s) - (RETENTION_DAYS * 86400)))
CUTOFF_DATE=$(date -d "@${CUTOFF_SECONDS}" +%Y%m%d 2>/dev/null || date -r ${CUTOFF_SECONDS} +%Y%m%d 2>/dev/null || echo "00000000")

for dir in "${BACKUP_BASE}"/*/; do
    dir_name=$(basename "${dir}")
    # Skip 'latest' symlink
    [ "${dir_name}" = "latest" ] && continue
    # Check if directory is older than retention period
    if [ -d "${dir}" ]; then
        # Extract date from directory name (YYYYMMDD_HHMMSS)
        dir_date="${dir_name:0:8}"
        if [ "${dir_date}" -lt "${CUTOFF_DATE}" ] 2>/dev/null; then
            log "Removing old backup: ${dir_name}"
            rm -rf "${dir}"
            DELETED_COUNT=$((DELETED_COUNT + 1))
        fi
    fi
done
log "Cleanup complete: removed ${DELETED_COUNT} old backups"

# Also cleanup mirrored backups
if [ -d "/backups-mirror/daily" ]; then
    log "Cleaning up mirrored backups older than ${RETENTION_DAYS} days..."
    MIRROR_DELETED_COUNT=0

    for dir in "/backups-mirror/daily"/*/; do
        dir_name=$(basename "${dir}")
        # Skip 'latest' symlink
        [ "${dir_name}" = "latest" ] && continue
        # Check if directory is older than retention period
        if [ -d "${dir}" ]; then
            # Extract date from directory name (YYYYMMDD_HHMMSS)
            dir_date="${dir_name:0:8}"
            if [ "${dir_date}" -lt "${CUTOFF_DATE}" ] 2>/dev/null; then
                log "Removing old mirrored backup: ${dir_name}"
                rm -rf "${dir}"
                MIRROR_DELETED_COUNT=$((MIRROR_DELETED_COUNT + 1))
            fi
        fi
    done
    log "Mirror cleanup complete: removed ${MIRROR_DELETED_COUNT} old backups"
fi

#######################################
# Summary
#######################################
log "=========================================="
log "Backup completed successfully!"
log "Location: ${BACKUP_DIR}"
log "Total size: $(numfmt --to=iec ${TOTAL_SIZE} 2>/dev/null || echo "${TOTAL_SIZE} bytes")"
log "Duration: ${DURATION} seconds"
log "=========================================="

exit 0
