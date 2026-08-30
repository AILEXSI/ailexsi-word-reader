# Local neural TTS (Chatterbox Multilingual V3)

Optional helper for AILEXSI Word Reader. The Vite app stays a listening module; this process only synthesizes short chunks for playback. German (`de-DE` → `de`) is the default.

Binds **127.0.0.1:8765 only**. Do not change that to `0.0.0.0`.

Do not put manuscripts in the repo.

## Install (RTX 4090) — git HEAD, not PyPI

PyPI `chatterbox-tts==0.1.7` does **not** accept `t3_model`. It only takes `device` and loads multilingual **V2** (`t3_mtl23ls_v2.safetensors`). V3 lives on git HEAD.

Verified: `torch 2.6.0+cu124` on an RTX 4090. Known venv:

`C:\Users\marti\ailexsi-word-reader\tts\.venv`

```bat
cd C:\Users\marti\ailexsi-word-reader
tts\.venv\Scripts\activate

REM 1. CUDA torch first (cu124). Do this before Chatterbox.
pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124

REM 2. Chatterbox V3 from git. --no-deps keeps pip from swapping in CPU torch.
pip install --no-deps git+https://github.com/resemble-ai/chatterbox.git

REM 3. German Thorsten ref (~9.5s) must exist at tts\ref_de_thorsten.wav

python tts\server.py
```

On Linux the same two pip lines apply, then `python tts/server.py`.

`server.py` calls `ChatterboxMultilingualTTS.from_pretrained(device="cuda" if available else "cpu", t3_model="v3")`. If `t3_model` is missing, the process errors and tells you to use the git install.

## German reference

`generate(..., language_id="de", audio_prompt_path=tts/ref_de_thorsten.wav, exaggeration=0.5, cfg_weight=0.5)`.

Use this German clip. An English `audio_prompt_path` stamps an English accent on German.

## Health / speak

```bash
curl -s http://127.0.0.1:8765/health
# {"ok": true, "backend": "chatterbox-multilingual-v3", "device": "cuda"}
```

`POST /speak` JSON `{ "text", "lang", "rate", "volume" }` → `audio/wav`. `de` / `de-DE` → `language_id="de"`.

Then `npm run dev` → `http://127.0.0.1:47291`. The app probes `/tts/health` (Vite proxies to 8765). If the server is down, Word Reader uses **Systemstimme**.

CORS allows `http://127.0.0.1:47291` and `http://localhost:47291`.
