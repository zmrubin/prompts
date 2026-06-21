# Connecting the SenseCAP Watcher to an external Hermes instance

This document describes how this firmware (the `78/xiaozhi-esp32` codebase, built for
the **Seeed Studio SenseCAP Watcher** board) is pointed at an external **Hermes** LLM
instance instead of the public xiaozhi.me / tenclass cloud or Seeed's own SenseCraft
backend.

## Why this codebase

The Watcher has two open-source firmware lineages:

| | Seeed `SenseCAP-Watcher-Firmware` | `78/xiaozhi-esp32` (this repo) |
|---|---|---|
| Nature | Native device SDK | MCP-based AI-chatbot firmware |
| LLM coupling | Tightly bound to SenseCraft cloud / task-flow engine | LLM is fully decoupled behind a server protocol |
| Backend swap | Requires reworking proprietary SenseCraft API calls | Change one endpoint; LLM is an OpenAI-compatible config |
| Modalities | Chat, voice, local Himax CV (task flow) | Chat, voice (ASR/TTS), vision via camera + MCP |
| Extensibility | Seeed's task-flow model | MCP tools (device + cloud), 70+ boards, MIT licensed |
| Community | Seeed-maintained | 100k+ devices, very active |

For a project whose goal is general operability across **chat, voice, and computer
vision** while talking to an **external** LLM, `78/xiaozhi-esp32` is the better base:
the language model already sits behind a clean, replaceable interface, so redirecting it
to Hermes is a configuration change rather than a firmware rewrite.

## Architecture

```
┌────────────────────┐   WebSocket / MQTT+UDP    ┌─────────────────────┐   OpenAI-compatible    ┌──────────────────┐
│  SenseCAP Watcher  │  (xiaozhi device proto)   │   Hermes gateway    │   HTTP (/v1/chat,      │  External Hermes │
│  (this firmware)   │ ────────────────────────▶ │ (xiaozhi-esp32-     │   /v1/embeddings, …)   │   LLM instance   │
│  audio · camera ·  │ ◀──────────────────────── │  server, self-host) │ ─────────────────────▶ │  (vLLM / TGI /   │
│  Himax CV · touch  │     ASR · TTS · vision     │  ASR · TTS · VAD ·  │ ◀───────────────────── │  llama.cpp, …)   │
└────────────────────┘                           │  MCP · LLM router   │                        └──────────────────┘
         ▲                                        └─────────────────────┘
         │ boot: HTTP "check version"  →  returns firmware + realtime server address
         └──────────────────────────────────────────────┘
```

The device never speaks to Hermes directly. It speaks the xiaozhi device protocol to a
self-hosted **gateway** ([`xinnan-tech/xiaozhi-esp32-server`](https://github.com/xinnan-tech/xiaozhi-esp32-server)),
which performs wake-word/VAD, ASR, TTS and tool routing, and forwards the actual language
/ multimodal turns to Hermes over an **OpenAI-compatible** API. Keeping Hermes behind the
gateway means voice and vision pipelines stay intact and the LLM is a single Base-URL swap.

## What changed in the firmware

The connection flow starts at `Ota::GetCheckVersionUrl()` (`main/ota.cc`), which reads the
`ota_url` NVS setting and falls back to `CONFIG_OTA_URL` (`main/Kconfig.projbuild`). The OTA
"check version" response carries the realtime WebSocket/MQTT server address the device then
uses for every conversation — so `OTA_URL` is the one place that selects the backend.

For the Watcher board, `CONFIG_OTA_URL` now defaults to a self-hosted Hermes gateway:

```kconfig
config OTA_URL
    string "Default OTA URL"
    default "https://hermes-gateway.example.com/xiaozhi/ota/" if BOARD_TYPE_SEEED_STUDIO_SENSECAP_WATCHER
    default "https://api.tenclass.net/xiaozhi/ota/"
```

> Replace `hermes-gateway.example.com` with your real gateway host before flashing
> (via `idf.py menuconfig` → *Xiaozhi Assistant* → *Default OTA URL*), or override it at
> runtime by writing the `ota_url` key in the `wifi` NVS namespace.

## Standing up the Hermes gateway

A turnkey, self-hosted deployment lives in [`deploy/hermes-gateway/`](../deploy/hermes-gateway/README.md):
Docker Compose running `xinnan-tech/xiaozhi-esp32-server` behind Caddy (automatic TLS),
with local VAD/ASR and the chat **LLM** + camera **VLLM** providers pointed at your
external Hermes endpoint. In short:

```bash
cd deploy/hermes-gateway
cp .env.example .env && $EDITOR .env   # GATEWAY_PUBLIC_HOST + HERMES_BASE_URL/MODEL/KEY
./render-config.sh && docker compose up -d
```

The Hermes binding is an OpenAI-compatible provider (`type: openai`, `url`, `model_name`,
`api_key`) — the device never speaks to Hermes directly; the gateway forwards to it. The
device's `OTA_URL` then points at `https://<GATEWAY_PUBLIC_HOST>/xiaozhi/ota/`, and the
gateway hands back the `wss://.../xiaozhi/v1/` realtime address so all traffic stays on
your VPS. Camera frames (Himax co-processor, `main/boards/sensecap-watcher/sscma_camera.cc`)
are routed through the gateway's vision endpoint to the Hermes VLLM provider.

## Build & flash (Watcher)

```bash
idf.py set-target esp32s3
idf.py menuconfig          # set Board Type = SenseCAP Watcher, confirm Default OTA URL
idf.py -DBOARD_NAME=sensecap-watcher build flash
```

> ⚠️ Back up the factory NVS (`0x9000`) before flashing if the unit still carries Seeed's
> stock firmware — it holds the device EUI/credentials. See the board's `README_en.md`.

## Decisions & open items

- **Architecture: device → self-hosted gateway → Hermes** (confirmed). Everything stays
  on infrastructure you own; the device contacts only your VPS.
- To finish a live deployment, fill `deploy/hermes-gateway/.env` with the real
  `GATEWAY_PUBLIC_HOST`, `HERMES_BASE_URL`, model ids and key, and set the firmware's
  `CONFIG_OTA_URL` to the matching `https://<host>/xiaozhi/ota/`.
- ⚠️ The default TTS (`EdgeTTS`) reaches Microsoft — the only third-party callout. Swap to
  a local engine for full isolation (see the deploy README).
</content>
</invoke>
