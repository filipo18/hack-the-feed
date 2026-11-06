#!/usr/bin/env bash
# Prepare or order the combined image on GMI Container.
# Prints variable names and statuses. Never prints secret values.
# GMI_API_KEY is inference only. GMI_COMPUTE_API_KEY is the console credential
# and is not placed in the container.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
console_api="https://console.gmicloud.ai/api"

usage() {
  cat <<'EOF'
Usage: scripts/gmi-deploy.sh <check|plan|env-names|build|save|catalog|order>

check       Print whether each variable is set or unset.
plan        Print the commands to run on the credentialed machine.
env-names   Print container env names only. The compute key is not one of them.
build       docker build -t hack-the-feed:local .   (no key build args)
save        docker save that image to dist/hack-the-feed-image.tar
catalog     GET /v1/containers/products with GMI_COMPUTE_API_KEY. Read-only.
order       Create a template and one container. Paid. Requires GMI_ORDER_CONFIRM=yes
            plus GMI_PRODUCT, GMI_IDC, GMI_EXPECTED_PRICE, and IMAGE_REF.

Do not paste secret values into chat, shell history, or this repo.
EOF
}

presence() {
  local name="$1"
  if [[ -n "${!name:-}" ]]; then
    printf '%s set\n' "$name"
  else
    printf '%s unset\n' "$name"
  fi
}

require() {
  local name
  for name in "$@"; do
    if [[ -z "${!name:-}" ]]; then
      printf 'refusing: %s is unset\n' "$name" >&2
      exit 2
    fi
  done
}

cmd_check() {
  local name
  for name in \
    ORIANE_API_KEY GMI_API_KEY GMI_MODEL GMI_COMPUTE_API_KEY \
    IMAGE_REF GMI_PRODUCT GMI_IDC GMI_EXPECTED_PRICE GMI_ORDER_CONFIRM \
    TLS_DOMAIN TLS_EMAIL GMI_REGISTRY_USERNAME GMI_REGISTRY_SECRET
  do
    presence "$name"
  done
  printf '%s\n' "GMI_COMPUTE_API_KEY authenticates https://console.gmicloud.ai/api and is not a container env."
  printf '%s\n' "GMI_API_KEY is sent only by the app to the GMI inference host."
}

cmd_plan() {
  cat <<'EOF'
Run these on the machine where the variables are already exported. Do not echo the values.

bash scripts/gmi-deploy.sh check
bash scripts/gmi-deploy.sh build
bash scripts/gmi-deploy.sh save
docker tag hack-the-feed:local "$IMAGE_REF"
docker push "$IMAGE_REF"
bash scripts/gmi-deploy.sh catalog
GMI_ORDER_CONFIRM=yes bash scripts/gmi-deploy.sh order

catalog is a price list, not an order. order creates a paid container only when
GMI_ORDER_CONFIRM=yes and GMI_PRODUCT, GMI_IDC, GMI_EXPECTED_PRICE, and IMAGE_REF are set.
Container env names: ORIANE_API_KEY, GMI_API_KEY, GMI_MODEL.
Optional container env names: ORIANE_BASE_URL, GMI_BASE_URL, TLS_DOMAIN, TLS_EMAIL.
Not a container env: GMI_COMPUTE_API_KEY.
EOF
}

cmd_env_names() {
  python3 - <<'PY'
import os
names = ["ORIANE_API_KEY", "GMI_API_KEY", "GMI_MODEL"]
for name in ("ORIANE_BASE_URL", "GMI_BASE_URL", "TLS_DOMAIN", "TLS_EMAIL"):
    if os.environ.get(name, "").strip():
        names.append(name)
if "GMI_COMPUTE_API_KEY" in names:
    raise SystemExit("refusing: compute key was selected as a container env")
print("\n".join(names))
PY
}

cmd_build() {
  docker build -t hack-the-feed:local "$root"
  docker image inspect hack-the-feed:local --format 'image {{.Id}}'
}

cmd_save() {
  mkdir -p "$root/dist"
  docker save hack-the-feed:local -o "$root/dist/hack-the-feed-image.tar"
  docker image inspect hack-the-feed:local --format 'image {{.Id}}' | tee "$root/dist/hack-the-feed-image.txt"
  printf '%s\n' "saved dist/hack-the-feed-image.tar"
}

cmd_catalog() {
  require GMI_COMPUTE_API_KEY
  python3 - "$console_api" <<'PY'
import json, os, sys, urllib.error, urllib.parse, urllib.request

base = sys.argv[1]
token = os.environ["GMI_COMPUTE_API_KEY"]
secrets = [os.environ.get(name, "") for name in ("GMI_API_KEY", "GMI_COMPUTE_API_KEY", "ORIANE_API_KEY", "GMI_REGISTRY_SECRET")]
secrets = [item for item in secrets if len(item) >= 4]

def redact(text: str) -> str:
    for secret in secrets:
        text = text.replace(secret, "[redacted]")
    return text

url = base + "/v1/containers/products"
if os.environ.get("GMI_IDC", "").strip():
    url += "?idc=" + urllib.parse.quote(os.environ["GMI_IDC"].strip())
request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token, "Accept": "application/json"})
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read().decode())
except urllib.error.HTTPError as exc:
    raise SystemExit(f"catalog HTTP {exc.code}")
if not isinstance(payload, list):
    raise SystemExit("catalog response was not a list")
for item in payload:
    if not isinstance(item, dict):
        continue
    row = {
        "idc": item.get("idc"),
        "name": item.get("name"),
        "price": item.get("price"),
        "gpuModel": item.get("gpuModel"),
        "productLine": item.get("productLine"),
        "type": item.get("type"),
        "valid": item.get("valid"),
    }
    print(redact(json.dumps(row, sort_keys=True)))
PY
}

cmd_order() {
  if [[ "${GMI_ORDER_CONFIRM:-}" != "yes" ]]; then
    printf '%s\n' "refusing to order: set GMI_ORDER_CONFIRM=yes only after catalog shows a price you accept" >&2
    exit 2
  fi
  require GMI_COMPUTE_API_KEY ORIANE_API_KEY GMI_API_KEY GMI_MODEL GMI_PRODUCT GMI_IDC GMI_EXPECTED_PRICE IMAGE_REF
  if [[ ! "${GMI_EXPECTED_PRICE}" =~ ^[0-9]+$ ]]; then
    printf '%s\n' "refusing to order: GMI_EXPECTED_PRICE must be a whole number from the catalog" >&2
    exit 2
  fi
  if [[ "${IMAGE_REF}" == *" "* || "${#IMAGE_REF}" -gt 253 || "${#IMAGE_REF}" -lt 1 ]]; then
    printf '%s\n' "refusing to order: IMAGE_REF must be one token of at most 253 characters" >&2
    exit 2
  fi
  printf 'ordering product %s in %s at acknowledged price %s\n' "$GMI_PRODUCT" "$GMI_IDC" "$GMI_EXPECTED_PRICE"
  python3 - "$console_api" <<'PY'
import json, os, sys, urllib.error, urllib.request

base = sys.argv[1]
token = os.environ["GMI_COMPUTE_API_KEY"]

def post(path, payload):
    request = urllib.request.Request(
        base + path,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.loads(response.read().decode() or "null")
    except urllib.error.HTTPError as exc:
        raise SystemExit(f"order HTTP {exc.code} from {path}")

template = {
    "name": os.environ.get("GMI_TEMPLATE_NAME", "hack-the-feed").strip() or "hack-the-feed",
    "path": os.environ["IMAGE_REF"].strip(),
}
username = os.environ.get("GMI_REGISTRY_USERNAME", "").strip()
registry_secret = os.environ.get("GMI_REGISTRY_SECRET", "")
if username or registry_secret:
    template["credential"] = {"username": username, "secret": registry_secret}

created = post("/v1/templates", template)
template_id = created.get("id") if isinstance(created, dict) else None
if not template_id:
    raise SystemExit("template response had no id")
print("template", template_id)

env_names = ["ORIANE_API_KEY", "GMI_API_KEY", "GMI_MODEL"]
for name in ("ORIANE_BASE_URL", "GMI_BASE_URL", "TLS_DOMAIN", "TLS_EMAIL"):
    if os.environ.get(name, "").strip():
        env_names.append(name)
envs = [{"name": name, "value": os.environ[name]} for name in env_names]
ports = [{"containerPort": 8000, "port": 8000, "protocol": "TCP"}]
if os.environ.get("TLS_DOMAIN", "").strip():
    ports.extend(
        [
            {"containerPort": 80, "port": 80, "protocol": "TCP"},
            {"containerPort": 443, "port": 443, "protocol": "TCP"},
        ]
    )
body = {
    "count": 1,
    "product": os.environ["GMI_PRODUCT"].strip(),
    "idc": os.environ["GMI_IDC"].strip(),
    "name": os.environ.get("GMI_CONTAINER_NAME", "hack-the-feed").strip() or "hack-the-feed",
    "templateId": template_id,
    "envs": envs,
    "ports": ports,
}
result = post("/v1/containers", body)
if not isinstance(result, list):
    raise SystemExit("container response had no id list")
for item in result:
    if isinstance(item, dict) and item.get("id"):
        print("container", item["id"])
PY
}

main() {
  local command="${1:-check}"
  case "$command" in
    check) cmd_check ;;
    plan) cmd_plan ;;
    env-names) cmd_env_names ;;
    build) cmd_build ;;
    save) cmd_save ;;
    catalog) cmd_catalog ;;
    order) cmd_order ;;
    -h|--help|help) usage ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "${1:-check}"
