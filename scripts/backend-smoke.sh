#!/usr/bin/env bash
# Checks GET /health on BASE_URL. POST /api/search runs only with --search.
# Does not print ORIANE_API_KEY, GMI_API_KEY, or GMI_MODEL.
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
BASE_URL="${BASE_URL%/}"
TIMEOUT="${SMOKE_TIMEOUT:-20}"
do_search=0
body="${SEARCH_BODY:-}"

usage() {
  cat <<'EOF'
Usage: scripts/backend-smoke.sh [--search] [--body JSON]

  BASE_URL        Origin to call (default http://127.0.0.1:8000)
  SMOKE_TIMEOUT   Curl max time in seconds (default 20)
  SEARCH_BODY     JSON for POST /api/search, used only together with --search

GET /health must return HTTP 200. Search is off unless --search is passed.
--search can spend Oriane and GMI credits. The default search JSON is a
stand-in ({"brand","aliases","platforms"}) until the core API schema is
merged. Override it with --body or SEARCH_BODY. Secret values are not printed.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --search)
      do_search=1
      shift
      ;;
    --body)
      if [[ $# -lt 2 ]]; then
        echo "missing JSON after --body" >&2
        exit 2
      fi
      body="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$BASE_URL" == *"@"* || "$BASE_URL" == *"?"* ]]; then
  echo "BASE_URL must be an origin without userinfo or a query string" >&2
  exit 2
fi

for name in ORIANE_API_KEY GMI_API_KEY; do
  val="${!name:-}"
  if [[ -n "$val" && "$BASE_URL" == *"$val"* ]]; then
    echo "BASE_URL contains a secret; refusing" >&2
    exit 2
  fi
done

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required" >&2
  exit 1
fi

tmp="$(mktemp)"
cleanup() {
  rm -f "$tmp"
}
trap cleanup EXIT

redact() {
  local text name val
  text="$(cat || true)"
  for name in ORIANE_API_KEY GMI_API_KEY GMI_MODEL; do
    val="${!name:-}"
    if [[ -n "$val" ]]; then
      text="${text//"$val"/[redacted]}"
    fi
  done
  printf '%s' "$text" | sed -E \
    -e 's/(ORIANE_API_KEY|GMI_API_KEY|GMI_MODEL)[[:space:]]*=[[:space:]]*[^[:space:]]+/\1=[redacted]/g' \
    -e 's/[Bb]earer[[:space:]]+[A-Za-z0-9._~+/=-]\{1,\}/Bearer [redacted]/g'
}

show_failure() {
  local label="$1"
  local code="$2"
  echo "${label} failed: HTTP ${code}" >&2
  head -c 400 "$tmp" | redact >&2 || true
  echo >&2
}

echo "GET ${BASE_URL}/health"
if ! code="$(curl -sS -o "$tmp" -w '%{http_code}' --max-time "$TIMEOUT" "${BASE_URL}/health")"; then
  echo "health request failed" >&2
  exit 1
fi
if [[ "$code" != "200" ]]; then
  show_failure "health" "$code"
  exit 1
fi
echo "health ok"

if [[ "$do_search" -eq 0 ]]; then
  echo "search skipped"
  exit 0
fi

if [[ -z "$body" ]]; then
  body='{"brand":"Ryanair","aliases":["ryanair"],"platforms":["instagram"]}'
fi

for name in ORIANE_API_KEY GMI_API_KEY; do
  val="${!name:-}"
  if [[ -n "$val" && "$body" == *"$val"* ]]; then
    echo "search body contains a secret; refusing" >&2
    exit 2
  fi
done

echo "POST ${BASE_URL}/api/search"
if ! code="$(curl -sS -o "$tmp" -w '%{http_code}' --max-time "$TIMEOUT" \
  -H 'Content-Type: application/json' \
  --data-binary "$body" \
  "${BASE_URL}/api/search")"; then
  echo "search request failed" >&2
  exit 1
fi
if [[ "$code" != "200" ]]; then
  show_failure "search" "$code"
  exit 1
fi
bytes="$(wc -c < "$tmp" | tr -d ' ')"
echo "search ok (${bytes} bytes)"
