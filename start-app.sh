#!/bin/bash
# Start the Node.js app in production mode
# This script ensures the app runs with proper environment loading

set -e

APP_PORT="${SHOPPABLE_VIDEO:-3002}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$APP_DIR/shoppable-video.pid"
APP_LOG="$APP_DIR/app.log"

cd "$APP_DIR"

NODE_VERSION="$(tr -d '\r\n' < .nvmrc)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use "$NODE_VERSION"
else
  echo "nvm was not found at $NVM_DIR/nvm.sh"
  exit 1
fi

# Stop only this app's previous process/port so other Cloudways apps are not affected.
if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE")"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
  fi
  rm -f "$PID_FILE"
fi

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${APP_PORT}/tcp" || true
elif command -v lsof >/dev/null 2>&1; then
  lsof -ti tcp:"${APP_PORT}" | xargs -r kill || true
fi

# Wait a moment
sleep 2

# Start the app
nohup env PORT="$APP_PORT" NODE_ENV=production npm start > "$APP_LOG" 2>&1 &
echo $! > "$PID_FILE"

echo "Shoppable app started on port $APP_PORT"
echo "Accessible via: https://phpstack-683830-6336116.cloudwaysapps.com"
