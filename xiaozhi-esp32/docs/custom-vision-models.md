# Custom detection models on the WiseEye2 (Himax HX6538)

Yes — you can run your own models on the Watcher's WiseEye2 AI co-processor and
custom-configure what it reacts to. This is **independent of the Hermes/LLM work**: the
WiseEye2 is a separate AI chip (Arm Cortex-M55 + Ethos-U55 NPU, 16 MB flash) that runs
local, always-on inference; the ESP32 just reads its results over SPI.

There are two layers of vision on this device — keep them distinct:

| Layer | Runs on | Good for | In this project |
|---|---|---|---|
| **Local detection** | WiseEye2 (this doc) | Always-on, low-latency, private triggers | Custom model + MCP config |
| **Scene understanding** | External **Hermes** VLLM | "Explain what you see", open-ended Q&A | `deploy/hermes-gateway` VLLM |

## 1. Building & deploying your own model

The WiseEye2 runs models through **SSCMA** (Seeed SenseCraft Model Assistant) /
`sscma-micro`. Supported architectures include **FOMO, Swift-YOLO, YOLOv8/YOLO11,
MobileNetV2/V4**, classification and pose — quantized **INT8** and compiled for the
Ethos-U55 with Vela.

Two ways to get a custom model:

- **No-code:** train on the [SenseCraft AI](https://sensecraft.seeed.cc/) web platform
  (bring your own images / a Roboflow dataset) and deploy to the Watcher from the browser.
- **Code:** train with the [SSCMA training repo](https://github.com/Seeed-Studio/ModelAssistant)
  (PyTorch → TFLite int8 → Himax), using
  [`sscma-example-we2`](https://github.com/Seeed-Studio/sscma-example-we2) as the We2
  deployment reference.

**Flashing to the Watcher:** when connected over USB the Watcher exposes **two serial
ports** — one for the ESP32, one for the Himax. You flash the model to the **Himax**
(via `python-sscma` / SenseCraft) **independently of the ESP32 app**, so updating your
detector does *not* require rebuilding this firmware.

> ⚠️ Back up the Himax/factory partitions before flashing (device EUI lives there) — see
> the board `README_en.md`. Model must fit 16 MB flash + WiseEye2 SRAM and use
> Ethos-U55-supported (Vela-compiled) int8 ops; anything heavier belongs on the Hermes
> VLLM path instead.

## 2. Configuring what the device reacts to

The firmware already reads detections from the WiseEye2 and reacts to them — see
`main/boards/sensecap-watcher/sscma_camera.cc`. It handles **boxes** (detection),
**classes** (classification) and **points** (pose), and runs a state machine with these
parameters (persisted in the `model` NVS namespace):

| Param | Meaning | Default |
|---|---|---|
| `target` | class **index** in your model to react to | 0 |
| `threshold` | min confidence score (0–100) | 75 |
| `duration` | seconds object must persist to confirm | 2 |
| `interval` | cooldown (s) after a trigger | 8 |
| `enable` | inference on/off | 0 |

On a confirmed detection it calls `Application::WakeWordInvoke("<detect>N <classname>
detected</detect>")` — i.e. it **wakes the assistant and tells Hermes what was seen**, so a
local WiseEye2 detection can kick off a voice alert or conversation. The `<classname>`
comes from your model's own label list (`model->classes[...]`), so **your custom model's
labels flow through automatically**.

### Configure it at runtime — no rebuild

These parameters are exposed as **MCP tools**, so you can change detection behavior by
voice / through Hermes (it calls the tools):

- `self.model.param_get` — read current `threshold` / `interval` / `duration` / `target`.
- `self.model.param_set` — set any of them (e.g. *"only alert me on dogs"* → set `target`
  to the dog class index; *"be less twitchy"* → raise `threshold` / `duration`).
- `self.model.enable` — turn local inference on/off (*"stop watching"*).

`target` is clamped to your model's class count, and is an **index**, not a name — so it
depends on your model's label order. `param_set` writes NVS, so settings survive reboot.

## Known firmware-side limit

The active model is selected by a hardcoded slot in `sscma_camera.cc`:

```cpp
sscma_client_set_model(sscma_client_handle_, 4);   // model id/slot 4
```

If your custom model is flashed to a different Himax slot/id, this line (two places) must
match it. We can lift this to a `Kconfig` option (and/or an MCP tool) so the model slot is
selectable without editing code — ask and it's a small change.
