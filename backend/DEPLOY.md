# Backend on GMI Container

Packaging only. This does not create a container, address, firewall, or registry push.

The process in the image is:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Inference stays on GMI: `POST https://api.gmi-serving.com/v1/chat/completions` with `Authorization: Bearer` taken from `GMI_API_KEY`. The model id is `GMI_MODEL`. Do not send inference to another host.

The Lovable app stays in `frontend/`. It is not this service.

## Build

Context is `backend/`:

```bash
docker build -t hack-the-feed-backend:local backend
```

The Dockerfile installs `requirements.txt`, then copies `app/`. The core API branch adds `backend/requirements.txt` and `backend/app/main.py` (FastAPI: `GET /health`, `POST /api/search`). Until those files are in the tree, `docker build` stops at `COPY`. That failure is expected.

`requirements.txt` has to `pip install` on `python:3.12-slim` with no compiler and before `app/` is copied. The server runs as uid 10001. Do not pass keys as build args. `.env` files are left out of the build context.

A copy of this Dockerfile in a throwaway directory, with a stub app, only checks the packaging. It is not this API.

## Run locally

Export the runtime variables in the shell. Do not commit them.

```bash
docker run --rm -p 8000:8000 \
  -e ORIANE_API_KEY \
  -e GMI_API_KEY \
  -e GMI_MODEL \
  hack-the-feed-backend:local
```

```bash
scripts/backend-smoke.sh
scripts/backend-smoke.sh --search
```

`BASE_URL` defaults to `http://127.0.0.1:8000`. `--search` can spend Oriane and GMI credits. Its default JSON is `{"brand":"Ryanair","aliases":["ryanair"],"platforms":["instagram"]}` until the core schema is merged. Override with `--body` or `SEARCH_BODY`.

## Host on GMI Container

Container access is gated per organization. If Cluster Engine shows "Not yet available", or Containers says no Container products are enabled, use Contact Support in the console. This account was not checked.

1. Push the image to a registry the platform can pull. Cluster Engine does not document building a Dockerfile for you. `GET /v1/images` is bare-metal OS images, not this image.
2. Register a template with `POST https://console.gmicloud.ai/api/v1/templates`. Auth is a console bearer token, not `GMI_API_KEY`. Required fields are `name` and `path` (URI, max 253 characters, no spaces). Put the image reference in `path`, for example `docker.io/ORG/hack-the-feed-backend:TAG`. For a private registry set `credential.username` and `credential.secret` on that request only. The console Add control is on Templates; the guide does not name the form fields.
3. Create the container with `POST /v1/containers`: `count`, `product`, `idc`, `name`, `templateId`. Set `envs` to `ORIANE_API_KEY`, `GMI_API_KEY`, and `GMI_MODEL`. Publish `containerPort` 8000, protocol `TCP` (at most five ports). Leave the start command unset so the image command runs. The templates page says workloads launch from a template; it does not list the clicks.
4. Use one data center for the container, Elastic IP, and firewall. Associate the EIP first, then the firewall. An EIP alone allows no inbound traffic. Allow TCP to the published port from the CIDR you actually use. Terminating the container does not release the EIP. An allocated EIP keeps billing until you release it.
5. Point the smoke script at the instance. Add `--search` only for a real upstream call.

```bash
BASE_URL=http://<eip>:<published-port> scripts/backend-smoke.sh
```

The firewall form has a rule type named HTTPS. The API rule is protocol, port range, and CIDR. No container certificate or TLS termination is documented, so this MVP is HTTP on the EIP.

Documented container products are GPU compute SKUs. A CPU-only size is not documented. The console catalog shows the price. Orders are pay-as-you-go or prepaid. There is a general credit balance in the console. This change did not open that balance, and it does not show that the balance pays Container SKUs. Inference token use is a separate call to `api.gmi-serving.com`.

Agentbox is a different product. Its image docs use internal port 8080. Do not host this API there.

## Not in the public docs

- Console template form labels, and the launch click-path.
- Which registries `path` accepts beyond a URI.
- The public port when `ports[].port` is omitted. Read the port on the instance and set `BASE_URL` to it.
- Whether a blank `command` replaces the image command. If the process is not uvicorn, set the start command to `uvicorn app.main:app --host 0.0.0.0 --port 8000`.
- Managed TLS.
- A non-GPU container product.
- This account's Container entitlement, and whether current credits pay Container orders.

## Sources

- [GPU Compute](https://docs.gmicloud.ai/cluster-engine) (entitlement, custom images)
- [Containers](https://docs.gmicloud.ai/cluster-engine/resources/containers) (EIP then firewall, no inbound without a firewall)
- [Templates](https://docs.gmicloud.ai/cluster-engine/resources/templates)
- [Elastic IP](https://docs.gmicloud.ai/cluster-engine/resources/elastic-ip)
- [Firewalls](https://docs.gmicloud.ai/cluster-engine/resources/firewalls) (HTTPS is a rule type)
- [Create template](https://docs.gmicloud.ai/api-reference/templates/create-template) (`name`, `path`, `credential`)
- [Create containers](https://docs.gmicloud.ai/api-reference/containers/create-containers) (`envs`, `ports`, `templateId`)
- [Credits](https://docs.gmicloud.ai/cluster-engine/user-management/credits-coupons)
- [LLM API](https://docs.gmicloud.ai/inference-engine/api-reference/llm-api-reference) (`https://api.gmi-serving.com/v1/chat/completions`)
