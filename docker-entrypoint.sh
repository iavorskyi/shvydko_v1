#!/bin/sh
set -e

echo "Running database migrations..."
node node_modules/prisma/build/index.js db push --skip-generate
echo "Migrations complete."

echo "Starting Next.js server..."
exec node server.js
