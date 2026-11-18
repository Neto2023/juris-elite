# -*- coding: utf-8 -*-
"""
JURIS ELITE - gerador de PDF a partir de uma peca HTML da casa.

    python identidade/sistema/gerar-pdf.py material/dossie-maraba/dossie-maraba.html

Por que existe, e por que NAO basta abrir o Chrome no arquivo:
o Chrome trata file:// como origem opaca e recusa, por CORS, o download de
fontes declaradas em @font-face. O resultado e um PDF silenciosamente
tipografado na fonte de sistema, sem Playfair, Source Serif nem Inter.
Este script sobe um servidor local na raiz do projeto e manda o Chrome
imprimir pelo http://127.0.0.1, que e origem valida. Ao final confere quais
familias ficaram embutidas e avisa se alguma caiu em fonte de fallback.
"""
import http.server, socketserver, threading, subprocess, sys, pathlib, time, os, tempfile, shutil

RAIZ = pathlib.Path(__file__).resolve().parents[2]
PORTA = 8777
FAMILIAS_DA_CASA = ("PlayfairDisplay", "SourceSerif4", "Inter")

CHROME = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]


def achar_navegador():
    for c in CHROME:
        if pathlib.Path(c).exists():
            return c
    raise SystemExit("Chrome ou Edge nao encontrado. Ajuste a lista CHROME neste script.")


def servir():
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=str(RAIZ), **k)

        def log_message(self, *a):
            pass

    srv = socketserver.TCPServer(("127.0.0.1", PORTA), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


def conferir_fontes(pdf):
    try:
        from pypdf import PdfReader
    except ImportError:
        print("  (pypdf nao instalado: pulei a conferencia de fontes)")
        return
    nomes = set()

    def walk(o, d=0):
        if d > 8:
            return
        try:
            o = o.get_object()
        except Exception:
            return
        if isinstance(o, dict):
            if o.get("/FontName"):
                nomes.add(str(o["/FontName"]).split("+")[-1])
            for v in o.values():
                walk(v, d + 1)
        elif isinstance(o, list):
            for v in o:
                walk(v, d + 1)

    r = PdfReader(str(pdf))
    for pg in r.pages:
        walk(pg)
    print(f"  paginas: {len(r.pages)}")
    print(f"  fontes embutidas: {', '.join(sorted(nomes)) or 'nenhuma'}")
    intrusas = [n for n in nomes if not any(f in n for f in FAMILIAS_DA_CASA)]
    if intrusas:
        print(f"  AVISO: fonte fora da marca no PDF: {', '.join(sorted(intrusas))}")
        print("         Causa usual: caractere fora do subconjunto latin/latin-ext")
        print("         (setas, simbolos matematicos) ou peso/estilo nao baixado")
        print("         em identidade/sistema/fontes.css.")


def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    origem = pathlib.Path(sys.argv[1]).resolve()
    if not origem.exists():
        raise SystemExit(f"nao encontrei {origem}")
    rel = origem.relative_to(RAIZ).as_posix()
    destino = pathlib.Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else origem.with_suffix(".pdf")

    srv = servir()
    time.sleep(0.6)
    # Perfil novo a cada execucao. Um perfil fixo guarda o CSS e as fontes em
    # disco e faz o Chrome renderizar a versao anterior da peca sem avisar.
    perfil = tempfile.mkdtemp(prefix="je-render-")
    cmd = [
        achar_navegador(), "--headless=new", "--disable-gpu", "--no-sandbox",
        f"--user-data-dir={perfil}", "--disk-cache-size=1", "--media-cache-size=1",
        "--virtual-time-budget=30000", "--run-all-compositor-stages-before-draw",
        "--no-pdf-header-footer", f"--print-to-pdf={destino}",
        f"http://127.0.0.1:{PORTA}/{rel}",
    ]
    print(f"renderizando {rel}")
    subprocess.run(cmd, capture_output=True)
    srv.shutdown()
    shutil.rmtree(perfil, ignore_errors=True)
    if not destino.exists():
        raise SystemExit("o navegador nao gerou o PDF")
    print(f"  gerado: {destino}  ({destino.stat().st_size // 1024} KB)")
    conferir_fontes(destino)


if __name__ == "__main__":
    main()
