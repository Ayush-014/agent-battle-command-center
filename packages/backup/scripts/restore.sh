#!/bin/bash
set -e

# Configuration
BACKUP_BASE="/backups/daily"
BACKUP_DIR="${BACKUP_BASE}/latest"

# Database config
PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT:-5432}"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-abcc}"
export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

# Flags
DRY_RUN=false
RESTORE_POSTGRES=false
RESTORE_WORKSPACE=false
RESTORE_ENV=false
RESTORE_ALL=false
LIST_BACKUPS=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Restore backup data for Agent Battle Command Center.

Options:
  --list              List available backups
  --postgres          Restore PostgreSQL database
  --workspace         Restore workspace files
  --env               Decrypt and restore .env file
  --all               Restore everything (interactive)
  --dry-run           Preview restore without making changes
  --backup DIR        Use specific backup directory (default: latest)
  -h, --help          Show this help message

Examples:
  $(basename "$0") --list
  $(basename "$0") --postgres --dry-run
  $(basename "$0") --all --backup 20260128_020000
EOF
    exit 0
}

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

confirm() {
    if [ "${DRY_RUN}" = true ]; then
        log "[DRY-RUN] Would execute: $1"
        return 1
    fi
    read -p "$1 (y/N): " response
    case "$response" in
        [yY][eE][sS]|[yY]) return 0 ;;
        *) return 1 ;;
    esac
}

list_backups() {
    echo ""
    echo "Available Backups:"
    echo "=================="
    echo ""

    for dir in "${BACKUP_BASE}"/*/; do
        dir_name=$(basename "${dir}")
        [ "${dir_name}" = "latest" ] && continue
        [ ! -d "${dir}" ] && continue

        if [ -f "${dir}/manifest.json" ]; then
            size=$(jq -r '.total_size_bytes' "${dir}/manifest.json" 2>/dev/null || echo "?")
            duration=$(jq -r '.duration_seconds' "${dir}/manifest.json" 2>/dev/null || echo "?")
            iso_time=$(jq -r '.iso_time' "${dir}/manifest.json" 2>/dev/null || echo "?")

            # Format size
            if [ "${size}" != "?" ]; then
                size_fmt=$(numfmt --to=iec ${size} 2>/dev/null || echo "${size}B")
            else
                size_fmt="?"
            fi

            # Check if this is the latest
            latest_target=$(readlink "${BACKUP_BASE}/latest" 2>/dev/null || echo "")
            if [ "${dir_name}" = "${latest_target}" ]; then
                echo -e "  ${GREEN}* ${dir_name}${NC} (latest)"
            else
                echo "    ${dir_name}"
            fi
            echo "      Time: ${iso_time}"
            echo "      Size: ${size_fmt}"
            echo ""
        else
            echo "    ${dir_name} (no manifest)"
            echo ""
        fi
    done
}

restore_postgres() {
    log "Restoring PostgreSQL database..."

    DUMP_FILE="${BACKUP_DIR}/postgres.sql.gz"
    if [ ! -f "${DUMP_FILE}" ]; then
        log_error "Database dump not found: ${DUMP_FILE}"
        return 1
    fi

    # Show info
    DUMP_SIZE=$(stat -f%z "${DUMP_FILE}" 2>/dev/null || stat -c%s "${DUMP_FILE}")
    log "Dump file: ${DUMP_FILE}"
    log "Dump size: $(numfmt --to=iec ${DUMP_SIZE} 2>/dev/null || echo "${DUMP_SIZE} bytes")"

    if [ "${DRY_RUN}" = true ]; then
        log "[DRY-RUN] Would drop and recreate database '${PG_DB}'"
        log "[DRY-RUN] Would restore from ${DUMP_FILE}"
        return 0
    fi

    if ! confirm "This will DROP and recreate the '${PG_DB}' database. Continue?"; then
        log "Database restore cancelled"
        return 0
    fi

    log "Dropping existing database..."
    psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${PG_DB};" || true

    log "Creating fresh database..."
    psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -c "CREATE DATABASE ${PG_DB};"

    log "Restoring data..."
    gunzip -c "${DUMP_FILE}" | psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB}" > /dev/null

    # Verify
    TABLE_COUNT=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${PG_DB}" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    log_success "Database restored! Tables: ${TABLE_COUNT}"
}

restore_workspace() {
    log "Restoring workspace..."

    ARCHIVE_FILE="${BACKUP_DIR}/workspace.tar.gz"
    if [ ! -f "${ARCHIVE_FILE}" ]; then
        log_error "Workspace archive not found: ${ARCHIVE_FILE}"
        return 1
    fi

    # Show info
    ARCHIVE_SIZE=$(stat -f%z "${ARCHIVE_FILE}" 2>/dev/null || stat -c%s "${ARCHIVE_FILE}")
    log "Archive file: ${ARCHIVE_FILE}"
    log "Archive size: $(numfmt --to=iec ${ARCHIVE_SIZE} 2>/dev/null || echo "${ARCHIVE_SIZE} bytes")"

    if [ "${DRY_RUN}" = true ]; then
        log "[DRY-RUN] Would extract workspace to /workspace"
        log "[DRY-RUN] Contents preview:"
        tar -tzf "${ARCHIVE_FILE}" | head -20
        return 0
    fi

    if ! confirm "This will overwrite files in /workspace. Continue?"; then
        log "Workspace restore cancelled"
        return 0
    fi

    log "Extracting workspace..."
    tar -xzf "${ARCHIVE_FILE}" -C /

    log_success "Workspace restored!"
}

restore_env() {
    log "Restoring .env file..."

    ENV_FILE="${BACKUP_DIR}/env.enc"
    if [ ! -f "${ENV_FILE}" ]; then
        log_error "Encrypted .env not found: ${ENV_FILE}"
        return 1
    fi

    if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
        log_error "BACKUP_ENCRYPTION_KEY not set. Cannot decrypt .env"
        return 1
    fi

    DEST_FILE="/env-restore/.env"

    if [ "${DRY_RUN}" = true ]; then
        log "[DRY-RUN] Would decrypt ${ENV_FILE} to ${DEST_FILE}"
        return 0
    fi

    if [ -f "${DEST_FILE}" ]; then
        if ! confirm "This will overwrite ${DEST_FILE}. Continue?"; then
            log ".env restore cancelled"
            return 0
        fi
    fi

    log "Decrypting .env..."
    if openssl enc -aes-256-cbc -d -pbkdf2 -in "${ENV_FILE}" -out "${DEST_FILE}" -pass "pass:${BACKUP_ENCRYPTION_KEY}"; then
        log_success ".env restored to ${DEST_FILE}"
    else
        log_error "Decryption failed. Wrong encryption key?"
        return 1
    fi
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --list)
            LIST_BACKUPS=true
            shift
            ;;
        --postgres)
            RESTORE_POSTGRES=true
            shift
            ;;
        --workspace)
            RESTORE_WORKSPACE=true
            shift
            ;;
        --env)
            RESTORE_ENV=true
            shift
            ;;
        --all)
            RESTORE_ALL=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --backup)
            BACKUP_DIR="${BACKUP_BASE}/$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Handle --list
if [ "${LIST_BACKUPS}" = true ]; then
    list_backups
    exit 0
fi

# Validate backup directory
if [ ! -d "${BACKUP_DIR}" ]; then
    # Resolve symlink if needed
    if [ -L "${BACKUP_DIR}" ]; then
        BACKUP_DIR=$(readlink -f "${BACKUP_DIR}")
    fi
    if [ ! -d "${BACKUP_DIR}" ]; then
        log_error "Backup directory not found: ${BACKUP_DIR}"
        log "Use --list to see available backups"
        exit 1
    fi
fi

log "Using backup: ${BACKUP_DIR}"

# Show dry-run notice
if [ "${DRY_RUN}" = true ]; then
    echo ""
    log_warn "DRY-RUN MODE - No changes will be made"
    echo ""
fi

# Handle --all
if [ "${RESTORE_ALL}" = true ]; then
    RESTORE_POSTGRES=true
    RESTORE_WORKSPACE=true
    RESTORE_ENV=true
fi

# Execute requested restores
RESTORE_COUNT=0

if [ "${RESTORE_POSTGRES}" = true ]; then
    restore_postgres && RESTORE_COUNT=$((RESTORE_COUNT + 1))
    echo ""
fi

if [ "${RESTORE_WORKSPACE}" = true ]; then
    restore_workspace && RESTORE_COUNT=$((RESTORE_COUNT + 1))
    echo ""
fi

if [ "${RESTORE_ENV}" = true ]; then
    restore_env && RESTORE_COUNT=$((RESTORE_COUNT + 1))
    echo ""
fi

# If nothing was selected, show usage
if [ "${RESTORE_COUNT}" -eq 0 ] && [ "${LIST_BACKUPS}" = false ]; then
    log_warn "No restore options selected."
    echo ""
    usage
fi

log "Restore complete!"
