#!/bin/bash
set -e

# Configuration
BACKUP_BASE="/backups/daily"
BACKUP_DIR="${BACKUP_BASE}/latest"
HEALTH_CHECK=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Verify backup integrity for Agent Battle Command Center.

Options:
  --health    Health check mode (for Docker HEALTHCHECK)
              Verifies latest backup exists and is < 25 hours old
  --backup DIR  Verify specific backup directory (default: latest)
  -h, --help    Show this help message

Examples:
  $(basename "$0")                    # Full verification of latest backup
  $(basename "$0") --health           # Quick health check for Docker
  $(basename "$0") --backup 20260128_020000
EOF
    exit 0
}

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_ok() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --health)
            HEALTH_CHECK=true
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
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

#######################################
# Health Check Mode
#######################################
if [ "${HEALTH_CHECK}" = true ]; then
    # Check if latest backup exists
    if [ ! -L "${BACKUP_BASE}/latest" ]; then
        echo "No backup found"
        exit 1
    fi

    LATEST_DIR=$(readlink -f "${BACKUP_BASE}/latest" 2>/dev/null)
    if [ ! -d "${LATEST_DIR}" ]; then
        echo "Latest backup directory missing"
        exit 1
    fi

    # Check manifest exists
    if [ ! -f "${LATEST_DIR}/manifest.json" ]; then
        echo "Manifest missing"
        exit 1
    fi

    # Check age (45 minutes = 2700 seconds, for 30-minute backup interval)
    MANIFEST_TIME=$(stat -c %Y "${LATEST_DIR}/manifest.json" 2>/dev/null || stat -f %m "${LATEST_DIR}/manifest.json")
    CURRENT_TIME=$(date +%s)
    AGE_SECONDS=$((CURRENT_TIME - MANIFEST_TIME))
    MAX_AGE=${BACKUP_MAX_AGE_SECONDS:-2700}  # 45 minutes default

    if [ "${AGE_SECONDS}" -gt "${MAX_AGE}" ]; then
        AGE_HOURS=$((AGE_SECONDS / 3600))
        echo "Backup too old: ${AGE_HOURS} hours"
        exit 1
    fi

    echo "Healthy: backup $(basename ${LATEST_DIR}) is $((AGE_SECONDS / 3600))h old"
    exit 0
fi

#######################################
# Full Verification Mode
#######################################
echo ""
echo "Backup Verification"
echo "==================="
echo ""

# Resolve backup directory
if [ -L "${BACKUP_DIR}" ]; then
    BACKUP_DIR=$(readlink -f "${BACKUP_DIR}")
fi

if [ ! -d "${BACKUP_DIR}" ]; then
    log_fail "Backup directory not found: ${BACKUP_DIR}"
    exit 1
fi

log "Verifying backup: ${BACKUP_DIR}"
echo ""

ERRORS=0
WARNINGS=0

#######################################
# 1. Check Manifest
#######################################
echo "1. Manifest Check"
if [ -f "${BACKUP_DIR}/manifest.json" ]; then
    if jq empty "${BACKUP_DIR}/manifest.json" 2>/dev/null; then
        log_ok "Manifest is valid JSON"

        # Show manifest summary
        TIMESTAMP=$(jq -r '.timestamp' "${BACKUP_DIR}/manifest.json")
        TOTAL_SIZE=$(jq -r '.total_size_bytes' "${BACKUP_DIR}/manifest.json")
        DURATION=$(jq -r '.duration_seconds' "${BACKUP_DIR}/manifest.json")

        echo "   Timestamp: ${TIMESTAMP}"
        echo "   Total size: $(numfmt --to=iec ${TOTAL_SIZE} 2>/dev/null || echo "${TOTAL_SIZE} bytes")"
        echo "   Duration: ${DURATION}s"
    else
        log_fail "Manifest is invalid JSON"
        ERRORS=$((ERRORS + 1))
    fi
else
    log_fail "Manifest not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

#######################################
# 2. Verify Checksums
#######################################
echo "2. Checksum Verification"
if [ -f "${BACKUP_DIR}/checksums.sha256" ]; then
    cd "${BACKUP_DIR}"
    if sha256sum -c checksums.sha256 > /dev/null 2>&1; then
        FILE_COUNT=$(wc -l < checksums.sha256)
        log_ok "All ${FILE_COUNT} checksums valid"
    else
        log_fail "Checksum verification failed!"
        sha256sum -c checksums.sha256 2>&1 | grep -v ": OK$"
        ERRORS=$((ERRORS + 1))
    fi
else
    log_warn "No checksums.sha256 file found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

#######################################
# 3. Verify Gzip Integrity
#######################################
echo "3. Archive Integrity"
for gz_file in "${BACKUP_DIR}"/*.gz; do
    [ -f "${gz_file}" ] || continue
    filename=$(basename "${gz_file}")
    if gzip -t "${gz_file}" 2>/dev/null; then
        SIZE=$(stat -f%z "${gz_file}" 2>/dev/null || stat -c%s "${gz_file}")
        log_ok "${filename} ($(numfmt --to=iec ${SIZE} 2>/dev/null || echo "${SIZE}B"))"
    else
        log_fail "${filename} is corrupted"
        ERRORS=$((ERRORS + 1))
    fi
done
echo ""

#######################################
# 4. Verify PostgreSQL Dump
#######################################
echo "4. PostgreSQL Dump Check"
PG_DUMP="${BACKUP_DIR}/postgres.sql.gz"
if [ -f "${PG_DUMP}" ]; then
    # Check if it's a valid pg_dump (starts with standard header)
    HEADER=$(gunzip -c "${PG_DUMP}" | head -5)
    if echo "${HEADER}" | grep -q "PostgreSQL database dump"; then
        log_ok "Valid PostgreSQL dump format"

        # Count tables in dump
        TABLE_COUNT=$(gunzip -c "${PG_DUMP}" | grep -c "^CREATE TABLE" || echo "0")
        echo "   Tables in dump: ${TABLE_COUNT}"
    else
        log_warn "Could not verify PostgreSQL dump format"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_fail "PostgreSQL dump not found"
    ERRORS=$((ERRORS + 1))
fi
echo ""

#######################################
# 5. Verify Workspace Archive
#######################################
echo "5. Workspace Archive Check"
WS_ARCHIVE="${BACKUP_DIR}/workspace.tar.gz"
if [ -f "${WS_ARCHIVE}" ]; then
    FILE_COUNT=$(tar -tzf "${WS_ARCHIVE}" | wc -l)
    if [ "${FILE_COUNT}" -gt 0 ]; then
        log_ok "Workspace archive contains ${FILE_COUNT} files/dirs"
    else
        log_warn "Workspace archive is empty"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_warn "Workspace archive not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

#######################################
# 6. Verify Ollama Models List
#######################################
echo "6. Ollama Models List"
MODELS_FILE="${BACKUP_DIR}/ollama-models.txt"
if [ -f "${MODELS_FILE}" ]; then
    MODEL_COUNT=$(grep -v "^#" "${MODELS_FILE}" | grep -c "." || echo "0")
    if [ "${MODEL_COUNT}" -gt 0 ]; then
        log_ok "${MODEL_COUNT} models recorded"
        echo "   Models: $(head -5 "${MODELS_FILE}" | tr '\n' ' ')"
    else
        log_warn "No models recorded (Ollama may have been unreachable)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    log_warn "Ollama models list not found"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

#######################################
# 7. Verify Encrypted .env
#######################################
echo "7. Encrypted .env Check"
ENV_FILE="${BACKUP_DIR}/env.enc"
if [ -f "${ENV_FILE}" ]; then
    SIZE=$(stat -f%z "${ENV_FILE}" 2>/dev/null || stat -c%s "${ENV_FILE}")
    if [ "${SIZE}" -gt 0 ]; then
        log_ok "Encrypted .env present (${SIZE} bytes)"
        if [ -n "${BACKUP_ENCRYPTION_KEY}" ]; then
            # Try to decrypt to /dev/null to verify key
            if openssl enc -aes-256-cbc -d -pbkdf2 -in "${ENV_FILE}" -out /dev/null -pass "pass:${BACKUP_ENCRYPTION_KEY}" 2>/dev/null; then
                log_ok "Encryption key is valid"
            else
                log_warn "Encryption key may be incorrect"
                WARNINGS=$((WARNINGS + 1))
            fi
        fi
    else
        log_warn "Encrypted .env is empty"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo "   No encrypted .env (encryption may not be configured)"
fi
echo ""

#######################################
# Summary
#######################################
echo "=========================================="
if [ "${ERRORS}" -eq 0 ] && [ "${WARNINGS}" -eq 0 ]; then
    echo -e "${GREEN}Verification PASSED${NC}"
    echo "All checks passed successfully!"
    EXIT_CODE=0
elif [ "${ERRORS}" -eq 0 ]; then
    echo -e "${YELLOW}Verification PASSED with warnings${NC}"
    echo "Warnings: ${WARNINGS}"
    EXIT_CODE=0
else
    echo -e "${RED}Verification FAILED${NC}"
    echo "Errors: ${ERRORS}, Warnings: ${WARNINGS}"
    EXIT_CODE=1
fi
echo "=========================================="

exit ${EXIT_CODE}
