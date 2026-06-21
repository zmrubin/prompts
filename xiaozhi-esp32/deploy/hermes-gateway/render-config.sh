#!/usr/bin/env bash
# Render config.template.yaml -> data/.config.yaml using values from .env
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "error: .env not found. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

# Load .env into the environment for envsubst.
set -a
# shellcheck disable=SC1091
source .env
set +a

: "${GATEWAY_PUBLIC_HOST:?set in .env}"
: "${HERMES_BASE_URL:?set in .env}"
: "${HERMES_CHAT_MODEL:?set in .env}"
: "${HERMES_VISION_MODEL:?set in .env}"
: "${HERMES_API_KEY:?set in .env}"

mkdir -p data
envsubst < config.template.yaml > data/.config.yaml
echo "Rendered data/.config.yaml for host '${GATEWAY_PUBLIC_HOST}' -> Hermes at '${HERMES_BASE_URL}'"
