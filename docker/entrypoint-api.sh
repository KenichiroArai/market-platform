#!/bin/sh
set -e

echo ""
echo "=============================================="
echo " [api] NestJS API を起動しています..."
echo "  ポート: ${API_PORT:-3001}"
echo "=============================================="
echo ""

exec node apps/api/dist/main.js
