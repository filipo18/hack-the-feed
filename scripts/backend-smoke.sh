#!/usr/bin/env bash
# GET /health. POST /api/search only with --search (that can spend credits).
# Prints status lines only, not response bodies or environment values.
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8000}"
BASE_URL="${BASE_URL%/}"
do_search=0
body='{"brand":"Ryanair","aliases":["ryanair"],"platforms":["instagram"]}'

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: scripts/backend-smoke.sh [--search] [--body JSON]"
  echo "BASE_URL defaults to http://127.0.0.1:8000. --search can spend credits."
  exit 0
fi

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
    *)
      echo "unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

curl -fsS -o /dev/null --max-time 20 "${BASE_URL}/health"
echo "health ok"

if [[ "$do_search" -eq 0 ]]; then
  echo "search skipped"
  exit 0
fi

curl -fsS -o /dev/null --max-time 20 \
  -H 'Content-Type: application/json' \
  --data-binary "$body" \
  "${BASE_URL}/api/search"
echo "search ok"
