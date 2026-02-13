#!/bin/sh
set -e

# =============================================================================
# Startup Validation
# =============================================================================
echo "Validating configuration..."

ERRORS=""

# Check DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  ERRORS="$ERRORS\n  [FATAL] DATABASE_URL is not set"
fi

# Check POSTGRES_PASSWORD in DATABASE_URL matches the env var (if both are accessible)
if [ -n "$DATABASE_URL" ]; then
  # Extract password from DATABASE_URL: postgresql://user:PASSWORD@host/db
  URL_PASSWORD=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  if [ -n "$URL_PASSWORD" ] && [ "$URL_PASSWORD" = "CHANGE_ME_generate_with_openssl_rand_hex_32" ]; then
    ERRORS="$ERRORS\n  [FATAL] DATABASE_URL still has placeholder password. Run: bash scripts/setup.sh"
  fi
fi

# Check API_KEY is set and not placeholder
if [ -z "$API_KEY" ]; then
  ERRORS="$ERRORS\n  [FATAL] API_KEY is not set"
elif [ "$API_KEY" = "CHANGE_ME_generate_with_openssl_rand_hex_32" ]; then
  ERRORS="$ERRORS\n  [FATAL] API_KEY is still the placeholder value. Run: bash scripts/setup.sh"
fi

# Check ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "sk-ant-api03-CHANGE_ME" ]; then
  echo "  [WARN] ANTHROPIC_API_KEY is not set. Ollama tasks will work, but Claude tasks will fail."
fi

# Fail fast on fatal errors
if [ -n "$ERRORS" ]; then
  echo ""
  echo "========================================="
  echo "  CONFIGURATION ERRORS - Cannot start"
  echo "========================================="
  printf "$ERRORS\n"
  echo ""
  echo "  Fix your .env file, or run:"
  echo "    bash scripts/setup.sh"
  echo "========================================="
  exit 1
fi

echo "Configuration OK."
echo ""

# =============================================================================
# Database Setup
# =============================================================================
echo "Setting up database schema..."
npx prisma db push --skip-generate

echo "Seeding database..."
npx prisma db seed || echo "Seeding skipped or already done"

echo "Starting server..."
exec node dist/index.js
