#!/usr/bin/env bash
# Redaction and refusal checks. This does not call GMI or Oriane and is not live proof.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
script="$root/scripts/gmi-deploy.sh"
fail=0

note() { printf '%s\n' "$1"; }

assert_absent() {
  local label="$1"
  local haystack="$2"
  local needle
  for needle in \
    SENTINEL_INFERENCE_9f3a \
    SENTINEL_COMPUTE_9f3a \
    SENTINEL_ORIANE_9f3a \
    SENTINEL_REGISTRY_9f3a
  do
    if [[ "$haystack" == *"$needle"* ]]; then
      note "FAIL $label leaked a sentinel"
      fail=1
      return
    fi
  done
}

with_sentinels() {
  env \
    GMI_API_KEY=SENTINEL_INFERENCE_9f3a \
    GMI_COMPUTE_API_KEY=SENTINEL_COMPUTE_9f3a \
    ORIANE_API_KEY=SENTINEL_ORIANE_9f3a \
    GMI_REGISTRY_SECRET=SENTINEL_REGISTRY_9f3a \
    GMI_MODEL=sentinel-model \
    "$@"
}

plan_out="$(with_sentinels bash "$script" plan)"
assert_absent plan "$plan_out"
if [[ "$plan_out" == *"Not a container env: GMI_COMPUTE_API_KEY."* ]]; then
  note "PASS plan-keeps-compute-key-out-of-container"
else
  note "FAIL plan-keeps-compute-key-out-of-container"
  fail=1
fi

check_out="$(with_sentinels bash "$script" check)"
assert_absent check "$check_out"
if [[ "$check_out" == *"GMI_API_KEY set"* && "$check_out" == *"GMI_COMPUTE_API_KEY set"* ]]; then
  note "PASS check-reports-presence-only"
else
  note "FAIL check-reports-presence-only"
  fail=1
fi

names_out="$(with_sentinels TLS_DOMAIN=example.com bash "$script" env-names)"
assert_absent env-names "$names_out"
if [[ "$names_out" == *"ORIANE_API_KEY"* && "$names_out" == *"GMI_API_KEY"* && "$names_out" == *"TLS_DOMAIN"* && "$names_out" != *"GMI_COMPUTE_API_KEY"* ]]; then
  note "PASS env-names"
else
  note "FAIL env-names"
  fail=1
fi

set +e
order_out="$(with_sentinels bash "$script" order 2>&1)"
order_code=$?
set -e
assert_absent order "$order_out"
if [[ "$order_code" -eq 2 && "$order_out" == *"refusing to order"* ]]; then
  note "PASS order-refuses-without-confirmation"
else
  note "FAIL order-refuses-without-confirmation"
  fail=1
fi

set +e
price_out="$(with_sentinels GMI_ORDER_CONFIRM=yes GMI_PRODUCT=example GMI_IDC=example IMAGE_REF=docker.io/example/hack-the-feed:local bash "$script" order 2>&1)"
price_code=$?
set -e
assert_absent order-price "$price_out"
if [[ "$price_code" -eq 2 && "$price_out" == *"GMI_EXPECTED_PRICE is unset"* ]]; then
  note "PASS order-refuses-without-price"
else
  note "FAIL order-refuses-without-price"
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  note "FAIL gmi-deploy-script"
  exit 1
fi
note "PASS gmi-deploy-script (redaction and refusal only, not a live provider call)"
