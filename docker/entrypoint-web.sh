#!/bin/sh
set -e

echo ""
echo "=============================================="
echo " [web] Next.js を起動しています..."
echo "  ポート: ${PORT:-3000}"
echo "=============================================="
echo ""

cd /app/apps/web
exec pnpm start
