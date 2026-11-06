# One image for the browser UI and the API. Do not pass API keys as build args.
FROM node:22-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STATIC_DIR=/app/static \
    PORT=8080
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl libcap2-bin \
    && curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=amd64" -o /usr/bin/caddy \
    && chmod 755 /usr/bin/caddy \
    && setcap cap_net_bind_service=+ep /usr/bin/caddy \
    && apt-get purge -y curl \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --root-user-action=ignore -r requirements.txt
COPY backend/app ./app
COPY --from=frontend /src/frontend/dist /app/static
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod 755 /entrypoint.sh \
    && chown -R appuser:appuser /app /home/appuser

USER appuser
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
    CMD ["python", "-c", "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/health' % os.environ.get('PORT','8080'), timeout=3)"]
ENTRYPOINT ["/entrypoint.sh"]
