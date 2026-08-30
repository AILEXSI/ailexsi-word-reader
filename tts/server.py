#!/usr/bin/env python3
"""Local Chatterbox Multilingual V3 TTS for AILEXSI Word Reader.

Binds 127.0.0.1:8765 only. Never expose this on 0.0.0.0.
"""

from __future__ import annotations

import inspect
import io
import json
import sys
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 8765
BACKEND = "chatterbox-multilingual-v3"
TTS_DIR = Path(__file__).resolve().parent
# German Thorsten clip (~9.5s). An English prompt would stamp an English accent.
REF_DE = TTS_DIR / "ref_de_thorsten.wav"
GIT_INSTALL = "pip install --no-deps git+https://github.com/resemble-ai/chatterbox.git"
ALLOWED_ORIGINS = {
    "http://127.0.0.1:47291",
    "http://localhost:47291",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
}

_MODEL = None
_MODEL_LOCK = threading.Lock()
_DEVICE = "cpu"


def _detect_device() -> str:
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def language_id(lang: str | None) -> str:
    if not lang:
        return "de"
    low = str(lang).lower().replace("_", "-").strip()
    if low.startswith("de"):
        return "de"
    code = low.split("-", 1)[0]
    return code or "de"


def _require_v3_api(cls) -> None:
    params = inspect.signature(cls.from_pretrained).parameters
    if "t3_model" not in params:
        raise RuntimeError(
            "PyPI chatterbox-tts==0.1.7 is multilingual V2 and does not accept t3_model. "
            f"After CUDA torch is installed, run: {GIT_INSTALL}"
        )


def get_model():
    global _MODEL
    with _MODEL_LOCK:
        if _MODEL is None:
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS

            _require_v3_api(ChatterboxMultilingualTTS)
            print(f"Loading Chatterbox Multilingual V3 on {_DEVICE}…", flush=True)
            # Git HEAD only. PyPI 0.1.7 from_pretrained(device=...) loads t3_mtl23ls_v2.
            _MODEL = ChatterboxMultilingualTTS.from_pretrained(
                device=_DEVICE,
                t3_model="v3",
            )
            print("Model ready.", flush=True)
        return _MODEL


def wav_bytes(tensor, sample_rate: int) -> bytes:
    audio = tensor.detach().cpu().numpy()
    if audio.ndim > 1:
        audio = audio.reshape(-1)
    peak = max(abs(float(audio.max())), abs(float(audio.min())), 1e-9)
    if peak > 1.0:
        audio = audio / peak
    pcm = (audio * 32767.0).astype("int16")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sample_rate))
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def generate_wav(text: str, lang: str) -> bytes:
    if not REF_DE.is_file():
        raise FileNotFoundError(
            f"German reference clip missing: {REF_DE}. "
            "Put Thorsten (~9.5s) at tts/ref_de_thorsten.wav. Do not use an English prompt."
        )
    model = get_model()
    wav = model.generate(
        text,
        language_id=language_id(lang),
        audio_prompt_path=str(REF_DE),
        exaggeration=0.5,
        cfg_weight=0.5,
    )
    return wav_bytes(wav, model.sr)


class TtsHandler(BaseHTTPRequestHandler):
    server_version = "AilexsiTts/1.0"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))

    def _route(self) -> str:
        return urlparse(self.path).path.rstrip("/") or "/"

    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self._route() == "/health":
            self._json(
                200,
                {"ok": True, "backend": BACKEND, "device": _DEVICE},
            )
            return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self._route() != "/speak":
            self._json(404, {"ok": False, "error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            payload = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            self._json(400, {"ok": False, "error": "invalid json"})
            return
        text = str(payload.get("text") or "").strip()
        if not text:
            self._json(400, {"ok": False, "error": "text is required"})
            return
        lang = str(payload.get("lang") or "de-DE")
        try:
            audio = generate_wav(text, lang)
        except Exception as exc:  # noqa: BLE001 — surface synthesis errors to the client
            self._json(500, {"ok": False, "error": str(exc)})
            return
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(audio)))
        self.end_headers()
        self.wfile.write(audio)


def main() -> None:
    global _DEVICE
    if HOST != "127.0.0.1":
        raise SystemExit("Refusing to bind anything other than 127.0.0.1")
    _DEVICE = _detect_device()
    server = ThreadingHTTPServer((HOST, PORT), TtsHandler)
    thread = threading.Thread(target=get_model, name="chatterbox-load", daemon=True)
    thread.start()
    print(f"AILEXSI TTS listening on http://{HOST}:{PORT} ({_DEVICE})", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping.", flush=True)
        server.shutdown()


if __name__ == "__main__":
    main()
