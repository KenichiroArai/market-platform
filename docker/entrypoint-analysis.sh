#!/bin/sh
set -e

echo ""
echo "=============================================="
echo " [analysis] FastAPI を起動しています..."
echo "  ポート: 8000"
echo "=============================================="
echo ""

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
