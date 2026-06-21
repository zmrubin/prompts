# Hermes gateway (self-hosted on your VPS)

Turnkey deployment of [`xinnan-tech/xiaozhi-esp32-server`](https://github.com/xinnan-tech/xiaozhi-esp32-server)
configured as the gateway between the SenseCAP Watcher and your external **Hermes**
LLM. The device talks **only to this VPS** over TLS; the gateway runs wake-word/VAD,
ASR and TTS locally and forwards chat + vision turns to Hermes over its OpenAI-compatible
`/v1` API.

```
Watcher ──wss/https──▶ Caddy (TLS, :443) ──▶ xiaozhi-server ──OpenAI /v1──▶ Hermes
            only host the device contacts        (this VPS)            (your infra)
```

## Prerequisites

- A VPS with Docker + Docker Compose, ports **80** and **443** open.
- A DNS A/AAAA record for `GATEWAY_PUBLIC_HOST` pointing at the VPS (needed for the
  device's `https` OTA URL and Caddy's automatic certificate).
- A reachable Hermes endpoint that speaks the OpenAI `/v1` API (vLLM / TGI /
  llama.cpp server). It can run on this same VPS or another host you control.

## Setup

```bash
cd deploy/hermes-gateway
cp .env.example .env
$EDITOR .env                     # set GATEWAY_PUBLIC_HOST + HERMES_* values

# Local ASR model (SenseVoiceSmall), mounted into the container:
mkdir -p models/SenseVoiceSmall
# download model.pt into models/SenseVoiceSmall/ — see the server repo's
# "model files" instructions (ModelScope/HuggingFace: SenseVoiceSmall).

./render-config.sh               # .env + template -> data/.config.yaml
docker compose up -d
docker compose logs -f xiaozhi-server   # confirm it loads HermesLLM + binds 8000/8003
```

`.env` and `data/` are gitignored, so your Hermes key and rendered config never get
committed.

## Point the firmware at this gateway

The firmware's `CONFIG_OTA_URL` (Watcher default in `main/Kconfig.projbuild`) must match
this host:

```
https://<GATEWAY_PUBLIC_HOST>/xiaozhi/ota/
```

Set it via `idf.py menuconfig` → *Xiaozhi Assistant* → *Default OTA URL*, or override at
runtime by writing the `ota_url` key in the `wifi` NVS namespace. On boot the device hits
that URL; the gateway responds with the `wss://.../xiaozhi/v1/` realtime address (from
`server.websocket`), and all chat/voice/vision flow over that single TLS connection to
this VPS. See `../../docs/hermes-integration.md` for the end-to-end picture.

## Vision

Camera frames captured by the Watcher's Himax co-processor are uploaded through the
device's MCP vision flow to `https://<host>/mcp/vision/explain` and routed to the
`VLLM` provider (`HermesVLLM`). Set `HERMES_VISION_MODEL` to a vision-capable model on
your Hermes endpoint. If your Hermes deployment serves text only, run a small VLM
(e.g. a Qwen-VL / Llava served via vLLM) and point `HERMES_VISION_MODEL` +/- a second
`url` at it.

## Privacy notes (everything-on-your-VPS)

- **Wake word** runs on the device. **VAD + ASR** run locally in the container
  (SileroVAD + SenseVoiceSmall) — no third party.
- **LLM + vision** go only to the `HERMES_BASE_URL` you set.
- ⚠️ **TTS default (`EdgeTTS`) calls Microsoft's online service.** It's the only
  third-party callout in the default config. For full isolation, see below.

### Keeping TTS on-VPS

Swap the `TTS` block in `config.template.yaml` (and `selected_module.TTS`) for a local
engine supported by the server — e.g. a self-hosted FishSpeech / GPT-SoVITS instance —
so synthesized speech never leaves the VPS. Re-run `./render-config.sh` and
`docker compose up -d`.

## Operations

```bash
docker compose ps
docker compose restart xiaozhi-server   # after editing .env + re-rendering
docker compose down
```

After changing `.env`, always re-run `./render-config.sh` before restarting.
