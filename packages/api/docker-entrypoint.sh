#!/bin/sh
set -e

echo "Setting up database schema..."
npx prisma db push --skip-generate

echo "Seeding database..."
npx prisma db seed || echo "Seeding skipped or already done"

echo "Starting server..."
exec node dist/index.js
