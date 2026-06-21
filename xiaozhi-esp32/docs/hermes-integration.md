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

1. Deploy `xinnan-tech/xiaozhi-esp32-server` (Docker is the quickest path). It exposes the
   xiaozhi OTA endpoint (default port `8002`) and the realtime WebSocket endpoint.
2. In the gateway's LLM provider config, set an **OpenAI-compatible** provider whose
   `base_url` points at your Hermes instance, e.g.:

   ```yaml
   LLM:
     HermesLLM:
       type: openai
       base_url: https://your-hermes-host:8000/v1
       model_name: hermes-3-llama-3.1-8b   # whatever your Hermes serves
       api_key: <token-or-EMPTY>
   ```

3. For **vision**, enable a vision-capable model on the same OpenAI-compatible endpoint
   (Hermes/served VLM) so camera frames uploaded by the device's MCP `take_photo` tool are
   routed to it. The Watcher's camera is driven by the Himax co-processor via
   `main/boards/sensecap-watcher/sscma_camera.cc`.
4. Point the firmware's `OTA_URL` at `https://<gateway-host>:8002/xiaozhi/ota/` and flash.

## Build & flash (Watcher)

```bash
idf.py set-target esp32s3
idf.py menuconfig          # set Board Type = SenseCAP Watcher, confirm Default OTA URL
idf.py -DBOARD_NAME=sensecap-watcher build flash
```

> ⚠️ Back up the factory NVS (`0x9000`) before flashing if the unit still carries Seeed's
> stock firmware — it holds the device EUI/credentials. See the board's `README_en.md`.

## Open items

- Confirm the **real Hermes gateway URL** and substitute it for the `example.com` placeholder.
- Confirm whether Hermes should be reached **via the gateway** (recommended, above) or
  whether a direct device→Hermes path is required (larger change: the device would need to
  speak the OpenAI HTTP API and move ASR/TTS off-board).
- Confirm the exact Hermes model id(s) for chat and for vision.
</content>
</invoke>
