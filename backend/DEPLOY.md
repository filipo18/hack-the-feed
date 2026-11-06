# Host the UI and API on GMI

One image serves both. The browser loads the frontend and calls `POST /api/search` on the same origin, so an HTTPS page does not call an HTTP API. `GET /health` stays on that origin. Unknown paths such as `/brands/Ryanair` return `index.html`.

`backend/Dockerfile` is the API-only image from the packaging change. Do not put the public site on that image. Build the repo-root image instead:

```bash
docker build -t hack-the-feed:local .
```

The build does not take API keys as build args. `ORIANE_API_KEY`, `GMI_API_KEY`, and `GMI_MODEL` are runtime environment only. Provider base URLs stay `ORIANE_BASE_URL` and `GMI_BASE_URL` on the server.

## Run locally

HTTP is for this machine and for a shell check. It is not the public URL.

```bash
docker run --rm -p 8000:8000 \
  -e ORIANE_API_KEY \
  -e GMI_API_KEY \
  -e GMI_MODEL \
  hack-the-feed:local
```

```bash
scripts/backend-smoke.sh
bash scripts/acceptance.sh
```

`scripts/acceptance.sh` prints `PASS`, `FAIL`, or `BLOCKED`. It does not print secret values. With the keys unset, search returns `oriane_not_configured` and an empty ranked list.

## HTTPS

Set `TLS_DOMAIN` to a hostname you control and `TLS_EMAIL` to a certificate contact. The entrypoint then keeps uvicorn on `127.0.0.1:8000` and runs Caddy on ports 80 and 443. Caddy is given `cap_net_bind_service` so uid 10001 can bind those ports. If the platform drops that capability, TLS will not start. That has not been verified on GMI.

```
example.com  A/AAAA  -> Elastic IP
firewall TCP 80 and 443 -> the container
```

A bare IP cannot get a public certificate. GMI Container docs do not issue certificates or map public 443 to a high port. The firewall type named HTTPS is an allow rule, not TLS termination. Agentbox's 443 mapping is a different product. Do not host this image there.

Without `TLS_DOMAIN`, the process listens on 8000 only.

## What is still required before a public deploy

This repo has no domain, no console token, and no confirmed container budget. Do not create a container, Elastic IP, or firewall until those are known. Orders are pay-as-you-go or prepaid, and the documented container products are GPU SKUs. A CPU-only size is not documented. Inference tokens are a separate charge on `api.gmi-serving.com`.

1. Container entitlement. If the console says it is not available, that is a blocker.
2. Push the image to a registry the platform can pull. `POST https://console.gmicloud.ai/api/v1/templates` needs a console bearer token, not `GMI_API_KEY`. `name` and `path` are required. Put the image reference in `path`.
3. `POST /v1/containers` with `count`, `product`, `idc`, `name`, `templateId`, and runtime `envs`. Leave the start command unset so `/entrypoint.sh` runs.
4. One data center for the container, Elastic IP, and firewall. Associate the EIP, then the firewall. An EIP alone allows no inbound traffic. Terminating the container does not release the EIP.
5. Point DNS at the EIP and set `TLS_DOMAIN` plus `TLS_EMAIL` before calling the site from a browser.

Checked from this environment: no `GMI_API_KEY`, `ORIANE_API_KEY`, `GMI_MODEL`, console token, or hostname was present. Nothing was provisioned.

## Sources

- [GPU Compute](https://docs.gmicloud.ai/cluster-engine)
- [Containers](https://docs.gmicloud.ai/cluster-engine/resources/containers)
- [Templates](https://docs.gmicloud.ai/cluster-engine/resources/templates)
- [Elastic IP](https://docs.gmicloud.ai/cluster-engine/resources/elastic-ip)
- [Firewalls](https://docs.gmicloud.ai/cluster-engine/resources/firewalls)
- [Create template](https://docs.gmicloud.ai/api-reference/templates/create-template)
- [Create containers](https://docs.gmicloud.ai/api-reference/containers/create-containers)
- [LLM API](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
