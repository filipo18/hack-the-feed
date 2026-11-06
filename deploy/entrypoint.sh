#!/bin/sh
# Serves the API and, when TLS_DOMAIN is set, HTTPS in front of it.
# Does not print environment values.
set -eu
cd /app

port="${PORT:-8080}"
case "$port" in
  ''|*[!0-9]*)
    echo "PORT must be a number" >&2
    exit 1
    ;;
esac

if [ -n "${TLS_DOMAIN:-}" ]; then
  if [ -z "${TLS_EMAIL:-}" ]; then
    echo "TLS_DOMAIN is set but TLS_EMAIL is empty. Refusing to start the public listener." >&2
    exit 1
  fi
  echo "TLS listener enabled for the configured hostname." >&2
  uvicorn app.main:app --host 127.0.0.1 --port "$port" --proxy-headers &
  pid=$!
  trap 'kill "$pid" 2>/dev/null || true' TERM INT
  exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "$port"
