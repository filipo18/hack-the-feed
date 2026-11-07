# Host the UI and API on GMI Agentbox

The image to register is the repo-root Dockerfile. It serves the compiled frontend and the API in one process. Agentbox terminates HTTPS and forwards to the internal port. This image binds `0.0.0.0:${PORT:-8080}`.

Agentbox injects `GMI_MAAS_API_KEY` at runtime. The process uses that value for inference when it is set, and otherwise uses `GMI_API_KEY`. `GMI_MODEL` is still required and is not chosen by the image. Neither key is logged. Whether an older inference key is accepted by `https://api.gmi-serving.com/v1` is unverified. The app calls that host with `httpx` (User-Agent `python-httpx/<version>`), `Authorization`, `Content-Type`, and `Accept`. It does not set a browser user agent. A separate `urllib` request is not this client.

If brand search returns `assessmentReason: gmi_error`, read `warnings`. `HTTP 403` plus a provider code is the model host refusing that request. `timed out` means a transport timeout occurred. Brand assessment uses `GMI_HTTP_TIMEOUT_SECONDS`, falling back to `HTTP_TIMEOUT_SECONDS` (default 20); the warning reports the configured timeout. A creator text call can succeed in that same process while the larger brand prompt does not. Do not treat those as the same failure.

## Durable start

The image `ENTRYPOINT` is `/entrypoint.sh`. It binds `${PORT:-8080}`. Agentbox `agents.create` and `agents.update` take `start_cmd`. That is the command a sandbox runs when it starts. `sandbox.execute` is a one-off command and is not the service. If an imported template does not run the image entrypoint, set `start_cmd` to `/entrypoint.sh` on the existing agent. Do not put keys on that command line. This repo does not call that update.

Registration, launching a sandbox, and marketplace publication are separate. This repo does not register a template or start a sandbox. A launch is paid. Do not publish the image as a public package from here.

## Registry

The repository `filipo18/hack-the-feed` is public. No container package was listed for it from this environment, and the Actions permission setting that allows `GITHUB_TOKEN` to write packages could not be read. `.github/workflows/image.yml` builds on pull requests and, on a push to `main` only, pushes one tag:

`ghcr.io/<repository owner lowercased>/hack-the-feed:<full git sha>`

That name follows GitHub's container registry convention. The package does not exist until that job succeeds. The workflow does not push `:latest` and does not change package visibility. A private package is the intended result. Agentbox can pull a private image only if registration has Requires sign-in with a registry username and a token that can read packages. This change does not create that token.

## Local image check

```bash
docker build -t hack-the-feed:local .
docker run --rm -p 8080:8080 hack-the-feed:local
```

Do not pass keys as build args. For a manual run, export `ORIANE_API_KEY`, `GMI_API_KEY` or `GMI_MAAS_API_KEY`, and `GMI_MODEL` in the shell.

`backend/Dockerfile` remains the API-only image. Do not register that one.

## Cluster Engine is not this path

`scripts/gmi-deploy.sh` orders a Cluster Engine container. That is not Agentbox. Do not run it for this hosting choice.

## Run locally without Agentbox

```bash
docker build -t hack-the-feed:local .
```

The build does not take API keys as build args. `ORIANE_API_KEY` and `GMI_API_KEY` are inference runtime values. `GMI_COMPUTE_API_KEY` is a different credential for `https://console.gmicloud.ai/api`. It stays on the operator machine and is not a container env and not a build arg.

## Commands for the credentialed machine

`scripts/gmi-deploy.sh` prints names and statuses only. Run it where the variables are already exported. Do not paste the values into chat or into the repo.

```bash
bash scripts/gmi-deploy.sh check
bash scripts/gmi-deploy.sh plan
bash scripts/gmi-deploy.sh build
bash scripts/gmi-deploy.sh save
docker tag hack-the-feed:local "$IMAGE_REF"
docker push "$IMAGE_REF"
bash scripts/gmi-deploy.sh catalog
GMI_ORDER_CONFIRM=yes \
  GMI_PRODUCT="<name from catalog>" \
  GMI_IDC="<idc from catalog>" \
  GMI_EXPECTED_PRICE="<price from catalog>" \
  IMAGE_REF="<registry image reference>" \
  bash scripts/gmi-deploy.sh order
```

`save` writes `dist/hack-the-feed-image.tar` and `dist/hack-the-feed-image.txt` (the image id). `dist/` is not committed. `catalog` is `GET /v1/containers/products` and prints `idc`, `name`, `price`, `gpuModel`, `productLine`, `type`, and `valid`. `order` is the paid call. It refuses unless `GMI_ORDER_CONFIRM=yes` and `GMI_EXPECTED_PRICE` is the whole number you accept from that catalog. It posts the template, then one container, and prints only the returned ids.

The container receives `ORIANE_API_KEY`, `GMI_API_KEY`, and `GMI_MODEL`. When `TLS_DOMAIN` is set it also receives `TLS_EMAIL` and publishes 80 and 443 in addition to 8000. A private registry can use `GMI_REGISTRY_USERNAME` and `GMI_REGISTRY_SECRET` on the template request only.

`bash scripts/test-gmi-deploy.sh` checks that the plan and the refusal paths do not print sentinel values. That test does not call GMI.

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

This repo has no domain and no confirmed container budget. The compute credential stays on the operator machine. Do not create a container, Elastic IP, or firewall until `catalog` has shown a price you accept. Orders are pay-as-you-go or prepaid, and the documented container products are GPU SKUs. A CPU-only size is not documented. Inference tokens are a separate charge on `api.gmi-serving.com`.

1. Container entitlement. If the console says it is not available, that is a blocker.
2. Push the image to a registry the platform can pull. `POST https://console.gmicloud.ai/api/v1/templates` uses `Authorization: Bearer` from `GMI_COMPUTE_API_KEY`, not from `GMI_API_KEY`. `name` and `path` are required. Put the image reference in `path`. `scripts/gmi-deploy.sh order` does this when you confirm a price.
3. `POST /v1/containers` with `count`, `product`, `idc`, `name`, `templateId`, and runtime `envs`. Leave the start command unset so `/entrypoint.sh` runs.
4. One data center for the container, Elastic IP, and firewall. Associate the EIP, then the firewall. An EIP alone allows no inbound traffic. Terminating the container does not release the EIP.
5. Point DNS at the EIP and set `TLS_DOMAIN` plus `TLS_EMAIL` before calling the site from a browser.

This agent VM does not have `ORIANE_API_KEY`, `GMI_API_KEY`, `GMI_MODEL`, or `GMI_COMPUTE_API_KEY`. Do not copy them here. Nothing was provisioned. `order` was not run. A container, Elastic IP, and firewall still have to be created from the credentialed machine after `catalog` shows a price you accept. An EIP alone allows no inbound traffic. Terminating the container does not release the EIP. Point DNS at that EIP before `TLS_DOMAIN` can get a certificate.

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
