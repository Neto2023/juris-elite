# -*- coding: utf-8 -*-
"""Servico de transcricao local para o atendente da Juris Elite.

Recebe o audio do WhatsApp em base64, transcreve com o faster-whisper (modelo
medium por padrao, rodando na CPU em int8) e devolve o texto. Fica so na rede
interna da stack: ninguem de fora alcanca, e nenhum audio sai do servidor.
"""
import os, json, base64, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from faster_whisper import WhisperModel

MODELO = os.environ.get("WHISPER_MODELO", "medium")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE = os.environ.get("WHISPER_COMPUTE", "int8")
IDIOMA = os.environ.get("WHISPER_IDIOMA", "pt")
ROOT = os.environ.get("WHISPER_MODELS_DIR", "/models")
PORTA = int(os.environ.get("WHISPER_PORTA", "8090"))
VAD = os.environ.get("WHISPER_VAD", "0") == "1"

print(f"[whisper] carregando modelo {MODELO} ({DEVICE}/{COMPUTE})...", flush=True)
modelo = WhisperModel(MODELO, device=DEVICE, compute_type=COMPUTE, download_root=ROOT)
print("[whisper] modelo pronto, ouvindo na porta", PORTA, flush=True)

# O modelo nao e garantidamente seguro para chamadas simultaneas: uma de cada vez.
trava = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def _responder(self, code, obj):
        corpo = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_GET(self):
        if self.path == "/health":
            self._responder(200, {"status": "ok", "modelo": MODELO})
        else:
            self._responder(404, {"erro": "nao encontrado"})

    def do_POST(self):
        if self.path != "/transcrever":
            return self._responder(404, {"erro": "nao encontrado"})
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            dados = json.loads(self.rfile.read(n) or b"{}")
            b64 = dados.get("base64") or ""
            if not b64:
                return self._responder(400, {"erro": "sem base64"})
            audio = base64.b64decode(b64)
            with tempfile.NamedTemporaryFile(suffix=".ogg", delete=True) as f:
                f.write(audio)
                f.flush()
                with trava:
                    segmentos, _ = modelo.transcribe(f.name, language=IDIOMA, vad_filter=VAD)
                    texto = "".join(s.text for s in segmentos).strip()
            self._responder(200, {"texto": texto})
        except Exception as e:  # noqa: BLE001
            self._responder(500, {"erro": str(e)[:200]})

    def log_message(self, *a):  # silencia o log de acesso padrao
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORTA), Handler).serve_forever()
