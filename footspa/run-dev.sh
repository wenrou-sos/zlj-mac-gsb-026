#!/usr/bin/env bash
# 一键启动足疗店实时运营面板（开发模式）
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"

# 后端虚拟环境 + 依赖
if [ ! -f "$DIR/backend/.venv/bin/uvicorn" ]; then
  python3 -m venv "$DIR/backend/.venv"
  "$DIR/backend/.venv/bin/pip" install -r "$DIR/backend/requirements.txt"
fi
"$DIR/backend/.venv/bin/uvicorn" app.main:app \
  --app-dir "$DIR/backend" --host 0.0.0.0 --port 8000 &
BACK_PID=$!

# 前端依赖
if [ ! -d "$DIR/frontend/node_modules" ]; then
  (cd "$DIR/frontend" && npm install)
fi
(cd "$DIR/frontend" && npm run dev) &
FRONT_PID=$!

echo ""
echo "  门口大屏:  http://localhost:5173/"
echo "  前台平板:  http://localhost:5173/desk"
echo ""

trap "kill $BACK_PID $FRONT_PID 2>/dev/null" EXIT
wait
