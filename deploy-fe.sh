#!/usr/bin/env bash
# Build & deploy CHỈ Frontend (service: client) lên VPS.
# Cách dùng:  ./deploy-fe.sh   (hoặc bấm chuột phải → Run in Terminal)
set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.https.yml"

echo "=========================================="
echo "  HungSilver — Deploy FE (client)"
echo "=========================================="

if [ ! -f .env ]; then
  echo "❌ Thiếu file .env cùng thư mục (xem .env.example). Dừng lại."
  read -rp "Nhấn Enter để đóng..." _
  exit 1
fi

echo "▶ Đang build & khởi động lại: client ..."
docker compose -f "$COMPOSE_FILE" up -d --build client

echo ""
echo "✅ Xong! Trạng thái container client:"
docker compose -f "$COMPOSE_FILE" ps client

echo ""
echo "ℹ Xem log:   docker compose -f $COMPOSE_FILE logs -f client"
read -rp "Nhấn Enter để đóng..." _
