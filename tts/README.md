# Local neural TTS (Chatterbox Multilingual V3)

Optional helper for AILEXSI Word Reader. The Vite app stays a listening module; this process only synthesizes short chunks for playback. German (`de-DE` → `de`) is the default.

Binds **127.0.0.1:8765 only**. Do not change that to `0.0.0.0`.

## Setup (RTX 4090)

```bash
# 1. CUDA torch first (cu124 wheel)
pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124

# 2. Chatterbox
pip install -r tts/requirements.txt

# 3. Start the server (loads the V3 multilingual checkpoint once)
python tts/server.py
```

Health check:

```bash
curl -s http://127.0.0.1:8765/health
# {"ok": true, "backend": "chatterbox-multilingual-v3", "device": "cuda"}
```

Then in another terminal: `npm run dev` and open `http://127.0.0.1:47291`.

The frontend probes `/tts/health` (Vite proxies to port 8765). If the server is down, Word Reader falls back to the browser **Systemstimme**.

## Speak

`POST /speak` with JSON `{ "text", "lang", "rate", "volume" }` returns `audio/wav`.

- `lang` `de` / `de-DE` maps to Chatterbox `language_id="de"`. Default `de`.
- Generation uses `exaggeration=0.5`, `cfg_weight=0.5`.
- **No `audio_prompt_path`.** An English reference clip would stamp an English accent on German.

CORS allows the Vite origins `http://127.0.0.1:47291` and `http://localhost:47291`.

Do not commit manuscripts, WAV samples, or model weights.
