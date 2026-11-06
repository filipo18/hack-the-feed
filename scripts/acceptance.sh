#!/usr/bin/env bash
# Local acceptance. Prints PASS, FAIL, or BLOCKED. Does not print secret values.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
python="$root/backend/.venv/bin/python"
fail=0

note() { printf '%s\n' "$1"; }

if [[ ! -x "$python" ]]; then
  python3 -m venv "$root/backend/.venv"
  "$root/backend/.venv/bin/pip" install -q -r "$root/backend/requirements-dev.txt"
fi

if (cd "$root" && bash scripts/test-gmi-deploy.sh); then
  note "PASS gmi-deploy-script"
else
  note "FAIL gmi-deploy-script"
  fail=1
fi

if (cd "$root/backend" && "$python" -m pytest -q); then
  note "PASS backend-pytest"
else
  note "FAIL backend-pytest"
  fail=1
fi

if (
  cd "$root/frontend"
  npm ci
  npm test
  npm run build
); then
  note "PASS frontend-unit-and-build"
else
  note "FAIL frontend-unit-and-build"
  exit 1
fi

if grep -R -n -E "Authorization: Bearer|ORIANE_API_KEY=.+|GMI_API_KEY=.+" "$root/frontend/dist" >/dev/null; then
  note "FAIL frontend-secret-scan"
  fail=1
else
  note "PASS frontend-secret-scan"
fi

if grep -R -n "Using sample data" "$root/frontend/dist" >/dev/null; then
  note "FAIL frontend-sample-not-shipped"
  fail=1
else
  note "PASS frontend-sample-not-shipped"
fi

port=8766
STATIC_DIR="$root/frontend/dist" ORIANE_API_KEY= GMI_API_KEY= GMI_MODEL= \
  "$python" -m uvicorn app.main:app --app-dir "$root/backend" --host 127.0.0.1 --port "$port" >/tmp/htf-acceptance-uvicorn.log 2>&1 &
server_pid=$!
cleanup() { kill "$server_pid" >/dev/null 2>&1 || true; }
trap cleanup EXIT

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done

if [[ "$ready" -ne 1 ]]; then
  note "FAIL local-boot"
  fail=1
else
  asset="$(python3 -c 'import re, pathlib, sys; text = pathlib.Path(sys.argv[1]).read_text(); match = re.search(r"/assets/[^\" ]+', text); print(match.group(0) if match else "")' "$root/frontend/dist/index.html")"
  search_file="$(mktemp)"
  if curl -fsS "http://127.0.0.1:${port}/" | grep -q 'id="root"' \
    && curl -fsS "http://127.0.0.1:${port}/brands/Ryanair" | grep -q 'id="root"' \
    && curl -fsS "http://127.0.0.1:${port}/for-creators" | grep -q 'id="root"' \
    && [[ -n "$asset" ]] \
    && curl -fsS -o /dev/null "http://127.0.0.1:${port}${asset}" \
    && curl -fsS -o "$search_file" -H 'Content-Type: application/json' \
      --data-binary '{"brand":"Ryanair","aliases":[],"platforms":["instagram","tiktok"]}' \
      "http://127.0.0.1:${port}/api/search" \
    && "$python" -c 'import json,sys; body=json.load(open(sys.argv[1])); assert body["assessmentReason"]=="oriane_not_configured"; assert body["rankedCreators"]==[]' "$search_file"
  then
    note "PASS local-boot"
  else
    note "FAIL local-boot"
    fail=1
  fi
  rm -f "$search_file"
fi

if (cd "$root/frontend" && npm run test:e2e); then
  note "PASS browser"
else
  note "FAIL browser"
  fail=1
fi

if sudo docker info >/dev/null 2>&1; then
  cid=""
  if sudo docker build -t hack-the-feed:local "$root"; then
    cid="$(sudo docker run -d --rm -p 127.0.0.1:8877:8080 -e ORIANE_API_KEY= -e GMI_API_KEY= -e GMI_MAAS_API_KEY= -e GMI_MODEL= hack-the-feed:local)"
    booted=0
    for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30; do
      if curl -fsS http://127.0.0.1:8877/health >/dev/null 2>&1; then
        booted=1
        break
      fi
      sleep 0.5
    done
    if [[ "$booted" -eq 1 ]] \
      && curl -fsS http://127.0.0.1:8877/health | grep -q '"status":"ok"' \
      && curl -fsS http://127.0.0.1:8877/brands/Ryanair | grep -q 'id="root"'; then
      if sudo docker logs "$cid" 2>&1 | grep -E -q 'ORIANE_API_KEY=.+|GMI_API_KEY=.+|GMI_MAAS_API_KEY=.+'; then
        note "FAIL container-boot-secret-log"
        fail=1
      else
        note "PASS container-boot"
      fi
    else
      note "FAIL container-boot"
      fail=1
    fi
  else
    note "FAIL container-build"
    fail=1
  fi
  if [[ -n "$cid" ]]; then
    sudo docker stop "$cid" >/dev/null 2>&1 || true
  fi
else
  note "BLOCKED container-boot docker daemon is not available"
  fail=1
fi

missing=()
for name in ORIANE_API_KEY GMI_API_KEY GMI_MODEL GMI_COMPUTE_API_KEY PUBLIC_HTTPS_URL GMI_PRODUCT GMI_IDC GMI_EXPECTED_PRICE; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done
if ((${#missing[@]})); then
  note "BLOCKED live-https-and-provider-search missing ${missing[*]}"
  note "BLOCKED gmi-deploy keys, hostname, or an accepted catalog price are not all present in this shell. Run scripts/gmi-deploy.sh on the credentialed machine. Do not copy secret values into this repo."
else
  note "BLOCKED live-https-and-provider-search credentials are present in this shell but this script does not send a paid deploy or a live search automatically"
fi

if [[ "$fail" -ne 0 ]]; then
  note "ACCEPTANCE local checks failed"
  exit 1
fi
note "ACCEPTANCE local checks passed; live HTTPS remains blocked until the missing inputs exist"
