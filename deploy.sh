#!/usr/bin/env bash
# Build & deploy TOÀN BỘ (Frontend + Backend) lên VPS.
# Cách dùng:  ./deploy.sh   (hoặc bấm chuột phải → Run as a Program / Run in Terminal)
set -euo pipefail

# Luôn chạy tại thư mục chứa script này, dù bấm/chạy từ đâu.
cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.https.yml"

echo "=========================================="
echo "  HungSilver — Deploy FE + BE (toàn bộ)"
echo "=========================================="

if [ ! -f .env ]; then
  echo "❌ Thiếu file .env cùng thư mục (xem .env.example). Dừng lại."
  read -rp "Nhấn Enter để đóng..." _
  exit 1
fi

echo "▶ Đang build & khởi động: postgres, api, client, caddy ..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo ""
echo "✅ Xong! Trạng thái các container:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "ℹ Xem log:   docker compose -f $COMPOSE_FILE logs -f api"
read -rp "Nhấn Enter để đóng..." _
