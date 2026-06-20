#!/usr/bin/env bash
# Build & deploy CHỈ Backend (service: api) lên VPS.
# Cách dùng:  ./deploy-be.sh   (hoặc bấm chuột phải → Run in Terminal)
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.https.yml"

echo "=========================================="
echo "  HungSilver — Deploy BE (api)"
echo "=========================================="

if [ ! -f .env ]; then
  echo "❌ Thiếu file .env cùng thư mục (xem .env.example). Dừng lại."
  read -rp "Nhấn Enter để đóng..." _
  exit 1
fi

echo "▶ Đang build & khởi động lại: api ..."
docker compose -f "$COMPOSE_FILE" up -d --build api

echo ""
echo "✅ Xong! Trạng thái container api:"
docker compose -f "$COMPOSE_FILE" ps api

echo ""
echo "ℹ Xem log:   docker compose -f $COMPOSE_FILE logs -f api"
read -rp "Nhấn Enter để đóng..." _
