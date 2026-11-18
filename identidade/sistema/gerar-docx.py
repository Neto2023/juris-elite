# -*- coding: utf-8 -*-
"""Converte o Dossie Maraba (HTML) para .docx no padrao Juris Elite.
Fontes do aluno: Cambria (leitura) e Calibri (rotulo/tabela), porque o .docx
renderiza na maquina dele e as fontes da marca nao estao la."""
import re, sys, pathlib
from lxml import html as LH
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

sys.stdout.reconfigure(encoding="utf-8")
RAIZ = pathlib.Path(r"C:\Users\LA Produções\Desktop\JURIS ELITE")
if len(sys.argv) < 3:
    raise SystemExit("uso: gerar_docx.py <peca.html> <saida.docx>")
SRC = pathlib.Path(sys.argv[1]).resolve()
OUT = pathlib.Path(sys.argv[2]).resolve()

MARINHO = RGBColor(0x10, 0x28, 0x3F)
CREME = RGBColor(0xF4, 0xF0, 0xE8)
GRAFITE = RGBColor(0x24, 0x28, 0x2C)
SUAVE = RGBColor(0x55, 0x60, 0x6B)
OURO_TXT = RGBColor(0x7B, 0x63, 0x38)
OURO_CLARO = RGBColor(0xD4, 0xBC, 0x8E)
ALERTA = RGBColor(0xC0, 0x39, 0x2B)
ACERTO = RGBColor(0x1E, 0x7A, 0x54)
H_MARINHO, H_OURO = "10283F", "B89A63"
H_CREME, H_ALERTA_F, H_ACERTO_F = "F4F0E8", "FBEAE7", "E7F4EE"

SERIF, SANS = "Cambria", "Calibri"


def el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn("w:" + k), v)
    return e


def largura_total(tbl):
    tblPr = tbl._tbl.tblPr
    for w in tblPr.findall(qn("w:tblW")):
        tblPr.remove(w)
    tblPr.append(el("w:tblW", w="5000", type="pct"))
    tbl.autofit = False


def sombrear(cell, cor):
    cell._tc.get_or_add_tcPr().append(el("w:shd", val="clear", color="auto", fill=cor))


def borda_celula(cell, lado, cor, sz="18"):
    tcPr = cell._tc.get_or_add_tcPr()
    b = tcPr.find(qn("w:tcBorders"))
    if b is None:
        b = el("w:tcBorders"); tcPr.append(b)
    b.append(el("w:" + lado, val="single", sz=sz, space="0", color=cor))


def margens_celula(cell, top=80, bottom=80, left=140, right=140):
    tcPr = cell._tc.get_or_add_tcPr()
    m = el("w:tcMar")
    for n, v in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        m.append(el("w:" + n, w=str(v), type="dxa"))
    tcPr.append(m)


def filete(par, cor=H_OURO, sz="18"):
    pPr = par._p.get_or_add_pPr()
    b = el("w:pBdr"); b.append(el("w:bottom", val="single", sz=sz, space="4", color=cor))
    pPr.append(b)


def espaco(par, antes=0, depois=6, entrelinha=None):
    pf = par.paragraph_format
    pf.space_before = Pt(antes); pf.space_after = Pt(depois)
    if entrelinha:
        pf.line_spacing = entrelinha


def add_run(par, txt, fonte=SERIF, tam=10.5, bold=False, italic=False,
            cor=GRAFITE, caps=False, espacejado=None, under=False):
    r = par.add_run(txt)
    r.font.name = fonte
    r.font.size = Pt(tam)
    r.bold = bold; r.italic = italic; r.underline = under
    r.font.color.rgb = cor
    r.font.all_caps = caps
    rPr = r._element.get_or_add_rPr()
    rf = rPr.find(qn("w:rFonts"))
    if rf is None:
        rf = el("w:rFonts"); rPr.insert(0, rf)
    for a in ("ascii", "hAnsi", "cs"):
        rf.set(qn("w:" + a), fonte)
    if espacejado:
        rPr.append(el("w:spacing", val=str(espacejado)))
    return r


def limpar(s):
    return re.sub(r"\s+", " ", s or "")


def inline(par, node, fonte=SERIF, tam=10.5, cor=GRAFITE, bold=False, italic=False):
    """Escreve o conteudo inline de um elemento preservando strong/em/u/br."""
    if node.text:
        t = limpar(node.text)
        if t.strip() or t == " ":
            add_run(par, t, fonte, tam, bold, italic, cor)
    for ch in node:
        if not isinstance(ch.tag, str):
            continue
        tg = ch.tag.lower()
        if tg == "br":
            par.add_run().add_break()
        elif tg in ("strong", "b"):
            inline(par, ch, fonte, tam, MARINHO if cor == GRAFITE else cor, True, italic)
        elif tg in ("em", "i"):
            inline(par, ch, fonte, tam, cor, bold, True)
        elif tg == "u":
            sub = limpar(ch.text_content())
            if sub:
                add_run(par, sub, fonte, tam, bold, italic, cor, under=True)
        else:
            inline(par, ch, fonte, tam, cor, bold, italic)
        if ch.tail:
            t = limpar(ch.tail)
            if t.strip() or t == " ":
                add_run(par, t, fonte, tam, bold, italic, cor)


def caixa(doc, fill, borda_cor):
    t = doc.add_table(rows=1, cols=1)
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    largura_total(t)
    c = t.cell(0, 0)
    sombrear(c, fill)
    borda_celula(c, "left", borda_cor, "24")
    margens_celula(c)
    c.paragraphs[0]._p.getparent().remove(c.paragraphs[0]._p)
    return t, c


def p_em(cell, primeiro=[True]):
    return cell.add_paragraph()


# ------------------------------------------------------------------ documento
doc = Document()
sec = doc.sections[0]
sec.page_height, sec.page_width = Cm(29.7), Cm(21.0)
sec.top_margin = Cm(2.2); sec.bottom_margin = Cm(2.0)
sec.left_margin = Cm(2.2); sec.right_margin = Cm(2.0)

normal = doc.styles["Normal"]
normal.font.name = SERIF
normal.font.size = Pt(10.5)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), SERIF)

raiz = LH.fromstring(SRC.read_text(encoding="utf-8"))
corpo = raiz.body

# ---- CAPA -----------------------------------------------------------------
capa = corpo.xpath(".//section[@class='capa']")[0]
logo_neg = RAIZ / "identidade" / "marca" / "juris-elite-horizontal-negativo.png"
logo_pos = RAIZ / "identidade" / "marca" / "juris-elite-horizontal.png"

tcapa = doc.add_table(rows=1, cols=1)
largura_total(tcapa)
ccapa = tcapa.cell(0, 0)
sombrear(ccapa, H_MARINHO)
margens_celula(ccapa, top=560, bottom=560, left=420, right=420)
ccapa.paragraphs[0]._p.getparent().remove(ccapa.paragraphs[0]._p)

p = ccapa.add_paragraph(); espaco(p, 0, 22)
p.add_run().add_picture(str(logo_neg), width=Cm(6.4))

# Tudo o que vai na capa sai do proprio HTML: assim o DOCX nunca diverge do PDF.
def capa_txt(seletor):
    achado = capa.xpath(seletor)
    return limpar(achado[0].text_content()).strip() if achado else ""


def capa_linhas(seletor):
    achado = capa.xpath(seletor)
    if not achado:
        return []
    bruto = LH.tostring(achado[0], encoding="unicode")
    bruto = re.sub(r"<br\s*/?>", "\n", bruto)
    texto = LH.fromstring(bruto).text_content()
    return [limpar(l).strip() for l in texto.split("\n") if limpar(l).strip()]


p = ccapa.add_paragraph(); espaco(p, 0, 10)
add_run(p, capa_txt(".//div[@class='rot']").upper(), SANS, 8.5, True,
        cor=OURO_CLARO, espacejado=28)

titulo_capa = capa_linhas(".//h1")
p = ccapa.add_paragraph(); espaco(p, 0, 4, 0.92)
add_run(p, " ".join(titulo_capa), SERIF, 38, True, cor=CREME)

p = ccapa.add_paragraph(); espaco(p, 6, 20)
add_run(p, capa_txt(".//p[@class='linha']"), SERIF, 13, italic=True,
        cor=RGBColor(0xB8, 0x9A, 0x63))

selo = capa.xpath(".//div[@class='selo']")
if selo:
    partes = limpar(selo[0].text_content()).split("·")
    p = ccapa.add_paragraph(); espaco(p, 0, 4)
    add_run(p, partes[0].strip(), SANS, 10, cor=CREME)
    if len(partes) > 1:
        p = ccapa.add_paragraph(); espaco(p, 0, 70)
        add_run(p, "·".join(partes[1:]).strip(), SANS, 11, True, cor=OURO_CLARO)

for linha in capa_linhas(".//div[@class='assina']"):
    p = ccapa.add_paragraph(); espaco(p, 0, 2)
    add_run(p, linha, SANS, 9, cor=RGBColor(0xC4, 0xD0, 0xDC))

doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# ---- RODAPE ---------------------------------------------------------------
rod = sec.footer.paragraphs[0]
rod.alignment = WD_ALIGN_PARAGRAPH.CENTER
assinatura = corpo.xpath(".//footer[@class='rodape']/span[last()]")
texto_rod = (limpar(assinatura[0].text_content()).strip() if assinatura
             else "Mentoria GMM Marabá · Prof. Walter Ruiz & Prof. Diego Souza (Edital 2026)")
add_run(rod, texto_rod, SANS, 8, cor=SUAVE)

# ---- CONVERSAO ------------------------------------------------------------
def classes(n):
    return (n.get("class") or "").split()


def tabela(doc, tnode):
    linhas = tnode.findall(".//tr")
    ncols = max(len(r.findall("./th")) + len(r.findall("./td")) for r in linhas)
    cap = tnode.find("./caption")
    if cap is not None:
        p = doc.add_paragraph(); espaco(p, 8, 3)
        add_run(p, limpar(cap.text_content()).upper(), SANS, 8, True, cor=OURO_TXT, espacejado=24)
    t = doc.add_table(rows=0, cols=ncols)
    t.style = "Table Grid"
    largura_total(t)
    for i, tr in enumerate(linhas):
        cels = tr.findall("./th") + tr.findall("./td")
        cels = [c for c in tr if c.tag in ("th", "td")]
        row = t.add_row()
        cabec = all(c.tag == "th" for c in cels)
        pai = tr.getparent().tag
        for j, c in enumerate(cels):
            if j >= ncols:
                break
            cell = row.cells[j]
            cell.paragraphs[0]._p.getparent().remove(cell.paragraphs[0]._p)
            margens_celula(cell, 50, 50, 90, 90)
            p = cell.add_paragraph(); espaco(p, 1, 1, 1.05)
            if cabec:
                sombrear(cell, H_MARINHO)
                inline(p, c, SANS, 9, CREME, bold=True)
                for r in p.runs:
                    r.font.color.rgb = CREME
            else:
                if pai == "tfoot":
                    sombrear(cell, H_CREME)
                elif i % 2 == 0:
                    sombrear(cell, "FBF9F5")
                inline(p, c, SANS, 9, GRAFITE, bold=(pai == "tfoot"))
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def bloco_caixa(doc, node, tipo):
    if tipo == "alerta":
        t, c = caixa(doc, H_ALERTA_F, "C0392B")
        tit = node.xpath("./p[@class='t'] | ./div[@class='t']")
        if tit:
            p = c.add_paragraph(); espaco(p, 0, 4)
            add_run(p, limpar(tit[0].text_content()).upper(), SANS, 8.5, True, cor=ALERTA, espacejado=16)
        for sub in node:
            if not isinstance(sub.tag, str):
                continue
            if sub.tag == "p" and "t" in classes(sub):
                continue
            if sub.tag == "p":
                p = c.add_paragraph(); espaco(p, 0, 4, 1.25)
                inline(p, sub, SERIF, 10, GRAFITE)
            elif sub.tag in ("ul", "ol"):
                for li in sub.findall("./li"):
                    p = c.add_paragraph(style="List Bullet"); espaco(p, 0, 2, 1.2)
                    inline(p, li, SERIF, 10, GRAFITE)
    elif tipo == "mnemo":
        t, c = caixa(doc, H_CREME, H_OURO)
        sig = node.xpath(".//span[@class='sigla']")
        if sig:
            p = c.add_paragraph(); espaco(p, 0, 4, 1.1)
            inline(p, sig[0], SERIF, 14, OURO_TXT, bold=True)
            for r in p.runs:
                r.font.color.rgb = OURO_TXT; r.bold = True
        for sub in node:
            if not isinstance(sub.tag, str) or "sigla" in classes(sub):
                continue
            if sub.tag == "p":
                p = c.add_paragraph(); espaco(p, 0, 2, 1.25)
                inline(p, sub, SERIF, 10, GRAFITE)
            elif sub.tag in ("ul", "ol"):
                for li in sub.findall("./li"):
                    p = c.add_paragraph(); espaco(p, 0, 2, 1.2)
                    add_run(p, "• ", SERIF, 10, cor=GRAFITE)
                    inline(p, li, SERIF, 10, GRAFITE)
    elif tipo == "texto-base":
        # Transcricao de lei: caixa de filete dourado, com a fonte na ultima
        # linha. E o dispositivo que diz ao aluno "isto aqui e a letra da lei".
        t, c = caixa(doc, "FBF9F5", H_OURO)
        for sub in node:
            if not isinstance(sub.tag, str):
                continue
            if sub.tag == "span" and "credito" in classes(sub):
                p = c.add_paragraph(); espaco(p, 4, 0, 1.1)
                inline(p, sub, SANS, 8, SUAVE)
            elif sub.tag == "p":
                p = c.add_paragraph(); espaco(p, 0, 4, 1.3)
                inline(p, sub, SERIF, 10, GRAFITE)
    elif tipo == "gab":
        t, c = caixa(doc, H_ACERTO_F, "1E7A54")
        tit = node.xpath("./p[@class='t'] | ./div[@class='t']")
        if tit:
            p = c.add_paragraph(); espaco(p, 0, 4)
            add_run(p, limpar(tit[0].text_content()).upper(), SANS, 8.5, True, cor=ACERTO, espacejado=16)
        for sub in node:
            if not isinstance(sub.tag, str) or "t" in classes(sub):
                continue
            if sub.tag == "p":
                p = c.add_paragraph(); espaco(p, 0, 4, 1.25)
                inline(p, sub, SERIF, 10, GRAFITE)
            elif sub.tag in ("ul", "ol"):
                for i, li in enumerate(sub.findall("./li"), 1):
                    p = c.add_paragraph(); espaco(p, 0, 3, 1.2)
                    add_run(p, f"{i}. " if sub.tag == "ol" else "• ", SERIF, 10, cor=GRAFITE)
                    inline(p, li, SERIF, 10, GRAFITE)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def cartao(doc, node):
    marinho = "cartao--marinho" in classes(node)
    t, c = caixa(doc, H_MARINHO if marinho else "FBF9F5", H_OURO)
    margens_celula(c, 140, 140, 180, 180)
    txt_cor = CREME if marinho else GRAFITE
    for sub in node:
        if not isinstance(sub.tag, str):
            continue
        cl = classes(sub)
        if sub.tag == "h4":
            p = c.add_paragraph(); espaco(p, 0, 6)
            add_run(p, limpar(sub.text_content()).upper(), SANS, 8.5, True,
                    cor=OURO_CLARO if marinho else OURO_TXT, espacejado=20)
        elif "grade" in cl:
            for d in sub.xpath(".//div[@class='dado']"):
                v = d.xpath("./span[@class='v']"); r_ = d.xpath("./span[@class='r']")
                p = c.add_paragraph(); espaco(p, 4, 0, 1.0)
                add_run(p, limpar(v[0].text_content()), SERIF, 18, True,
                        cor=OURO_CLARO if marinho else MARINHO)
                if r_:
                    p2 = c.add_paragraph(); espaco(p2, 0, 4, 1.15)
                    inline(p2, r_[0], SANS, 8.5,
                           RGBColor(0xA9, 0xB6, 0xC4) if marinho else SUAVE)
        elif sub.tag == "p":
            p = c.add_paragraph(); espaco(p, 4, 4, 1.25)
            inline(p, sub, SERIF, 10, txt_cor)
        elif sub.tag in ("ol", "ul"):
            for i, li in enumerate(sub.findall("./li"), 1):
                p = c.add_paragraph(); espaco(p, 0, 3, 1.25)
                add_run(p, f"{i}. " if sub.tag == "ol" else "• ", SERIF, 10, cor=txt_cor)
                inline(p, li, SERIF, 10, txt_cor)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)


def questao(doc, node):
    cab = node.xpath("./p[@class='cab'] | ./div[@class='cab']")
    if cab:
        p = doc.add_paragraph(); espaco(p, 14, 2)
        filete(p, "E3DCCD", "6")
        add_run(p, limpar(cab[0].text_content()), SERIF, 12, True, cor=MARINHO)
    ets = [limpar(e.text_content()) for e in node.xpath(".//span[contains(concat(' ',normalize-space(@class),' '),' et ')]")]
    if ets:
        p = doc.add_paragraph(); espaco(p, 2, 6)
        add_run(p, "  ·  ".join(ets).upper(), SANS, 7.5, True, cor=OURO_TXT, espacejado=16)
    for sub in node:
        if not isinstance(sub.tag, str):
            continue
        cl = classes(sub)
        if sub.tag in ("p", "div") and ("cab" in cl):
            continue
        if "etiquetas" in cl:
            continue
        if sub.tag == "p" and "edital" in cl:
            # Classificacao no conteudo programatico: linha de apoio, miuda.
            p = doc.add_paragraph(); espaco(p, 0, 5, 1.2)
            inline(p, sub, SANS, 8.5, SUAVE)
        elif sub.tag == "p":
            p = doc.add_paragraph(); espaco(p, 0, 5, 1.3)
            inline(p, sub, SERIF, 10.5, GRAFITE)
        elif sub.tag == "ul" and "alt" in cl:
            for li in sub.findall("./li"):
                p = doc.add_paragraph(); espaco(p, 0, 3, 1.25)
                p.paragraph_format.left_indent = Cm(0.7)
                p.paragraph_format.first_line_indent = Cm(-0.7)
                inline(p, li, SERIF, 10.5, GRAFITE)
        elif "gab" in cl:
            bloco_caixa(doc, sub, "gab")
        elif "texto-base" in cl:
            bloco_caixa(doc, sub, "texto-base")
        elif "mnemo" in cl:
            bloco_caixa(doc, sub, "mnemo")
        elif "alerta" in cl:
            bloco_caixa(doc, sub, "alerta")
        elif "cartao" in cl:
            cartao(doc, sub)
        elif sub.tag in ("ul", "ol"):
            for i, li in enumerate(sub.findall("./li"), 1):
                p = doc.add_paragraph(); espaco(p, 0, 3, 1.25)
                p.paragraph_format.left_indent = Cm(0.8)
                p.paragraph_format.first_line_indent = Cm(-0.45)
                add_run(p, f"{i}. " if sub.tag == "ol" else "• ", SERIF, 10.5,
                        cor=OURO_TXT, bold=True)
                inline(p, li, SERIF, 10.5, GRAFITE)
        elif sub.tag == "table":
            tabela(doc, sub)


def percorrer(doc, pai):
    for node in pai:
        if not isinstance(node.tag, str):
            continue
        tg = node.tag.lower()
        cl = classes(node)
        if "nova-pagina" in cl:
            doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
        if tg == "header":
            continue
        if tg == "h2":
            rot = node.xpath("./span[@class='n']")
            if rot:
                p = doc.add_paragraph(); espaco(p, 10, 2)
                add_run(p, limpar(rot[0].text_content()).upper(), SANS, 8.5, True,
                        cor=OURO_TXT, espacejado=24)
            titulo = limpar(node.text_content())
            if rot:
                rt = limpar(rot[0].text_content())
                if rt and titulo.startswith(rt):
                    titulo = titulo[len(rt):]
            p = doc.add_paragraph(); espaco(p, 0, 10, 1.05)
            filete(p)
            add_run(p, titulo.strip(), SERIF, 19, True, cor=MARINHO)
        elif tg == "h3":
            p = doc.add_paragraph(); espaco(p, 12, 5, 1.1)
            add_run(p, limpar(node.text_content()), SERIF, 13.5, True, cor=MARINHO)
        elif tg == "h4":
            p = doc.add_paragraph(); espaco(p, 10, 4)
            add_run(p, limpar(node.text_content()).upper(), SANS, 8.5, True,
                    cor=OURO_TXT, espacejado=20)
        elif tg == "p":
            p = doc.add_paragraph()
            if "fonte" in cl:
                espaco(p, 0, 8, 1.15)
                inline(p, node, SANS, 8.5, SUAVE)
            else:
                espaco(p, 0, 6, 1.35)
                p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                inline(p, node, SERIF, 10.5, GRAFITE)
        elif tg in ("ul", "ol"):
            for i, li in enumerate(node.findall("./li"), 1):
                p = doc.add_paragraph(); espaco(p, 0, 4, 1.3)
                p.paragraph_format.left_indent = Cm(0.8)
                p.paragraph_format.first_line_indent = Cm(-0.45)
                add_run(p, f"{i}. " if tg == "ol" else "• ", SERIF, 10.5, cor=OURO_TXT, bold=True)
                inline(p, li, SERIF, 10.5, GRAFITE)
        elif tg == "table":
            tabela(doc, node)
        elif tg in ("div", "article", "aside", "section"):
            if "tscroll" in cl:
                for tb in node.findall("./table"):
                    tabela(doc, tb)
            elif "texto-base" in cl:
                bloco_caixa(doc, node, "texto-base")
            elif "alerta" in cl:
                bloco_caixa(doc, node, "alerta")
            elif "mnemo" in cl:
                bloco_caixa(doc, node, "mnemo")
            elif "cartao" in cl:
                cartao(doc, node)
            elif "questao" in cl:
                questao(doc, node)
            else:
                percorrer(doc, node)
        elif tg == "footer":
            continue


folha = corpo.xpath(".//div[@class='folha']")[0]
percorrer(doc, folha)

doc.save(str(OUT))
print("gerado:", OUT)
print("paragrafos:", len(doc.paragraphs), "tabelas:", len(doc.tables))
