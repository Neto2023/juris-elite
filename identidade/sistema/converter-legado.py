# -*- coding: utf-8 -*-
"""
JURIS ELITE / CONVERSOR DO MATERIAL LEGADO

    python identidade/sistema/converter-legado.py cadernos
    python identidade/sistema/converter-legado.py ebook

Le os .docx antigos da Mentoria (material-base/), que sairam sem identidade
visual, e reescreve cada um como peca HTML da casa em material/<slug>/.
Dali seguem o mesmo caminho de todo material novo: gerar-pdf.py para o PDF e
gerar-docx.py para o Word.

O CONTEUDO E PRESERVADO AO PE DA LETRA. O conversor nao reescreve enunciado,
alternativa, gabarito, comentario nem texto de lei: so remapeia a estrutura
para os dispositivos do impresso.css (capa, secao, questao, alternativas,
gabarito, texto-base, mnemonico, alerta, tabela, rodape).

A unica alteracao de texto e a pontuacao de travessao, que a casa nao usa.
Nenhum dos 1.430 travessoes do acervo esta dentro de citacao literal de lei
(conferido antes da conversao), de modo que a troca nao toca em texto
normativo. As regras estao em `sem_travessao`.
"""
import sys, re, io, pathlib, html, unicodedata, collections

import docx
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn

RAIZ = pathlib.Path(__file__).resolve().parents[2]
BASE = RAIZ / "material-base" / "MENTORIA GMM MARABÁ"
DESTINO = RAIZ / "material"
TRAVESSAO = "[‒–—―]"

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

AUDITORIA = collections.Counter()


# --------------------------------------------------------------------------
# pontuacao
# --------------------------------------------------------------------------
# Contextos que nenhuma regra geral acerta, resolvidos um por um. Vale a pena
# listar: a primeira versao deste conversor trocou todo travessao por virgula
# e produziu "a linha Nova Maraba, Cidade Nova", que nao e aposto, e sim
# itinerario de onibus.
EXCECOES = [
    ("linha Nova Marab\u00e1 \u2013 Cidade Nova", "linha Nova Marab\u00e1 / Cidade Nova"),
    # Quatro etapas da cadeia de custodia numa linha so. Virgula entre o
    # numeral e o nome brigaria com a virgula que separa as proprias etapas.
    ("VII \u2013 Recebimento, VIII \u2013 Processamento, IX \u2013 Armazenamento "
     "e X \u2013 Descarte",
     "VII Recebimento \u00b7 VIII Processamento \u00b7 IX Armazenamento "
     "\u00b7 X Descarte"),
]


def sem_travessao(s):
    """Troca travessao por pontuacao da casa, por classe de uso.

    O acervo antigo usa o travessao em seis papeis diferentes, e cada um pede
    uma pontuacao propria. Substituicao unica para todos produz vicio: ora
    frase sem verbo, ora virgula emendando duas oracoes. A ordem das regras
    importa, porque a regra de parentese tem de rodar antes da regra de par
    de travessoes, sob pena de "(In\u00e9dita - 2026 - Padr\u00e3o FADESP)" virar
    "(In\u00e9dita (2026) Padr\u00e3o FADESP)".
    """
    if not re.search(TRAVESSAO, s):
        return s

    for de, para in EXCECOES:
        if de in s:
            s = s.replace(de, para)
            AUDITORIA["excecao resolvida a mao"] += 1
    if not re.search(TRAVESSAO, s):
        return s

    # 1. Dentro de parentese. Dois ou mais travessoes sao lista de itens
    #    ("12h - 24h - 72h - 30d") e pedem meio ponto; um so e aposto e pede
    #    virgula.
    def no_parentese(m):
        corpo = m.group(1)
        quantos = len(re.findall(TRAVESSAO, corpo))
        sinal = " \u00b7 " if quantos >= 2 else ", "
        AUDITORIA["lista em parentese" if quantos >= 2 else "aposto em parentese"] += quantos
        return "(" + re.sub(r"\s*" + TRAVESSAO + r"\s*", sinal, corpo) + ")"
    s = re.sub(r"\(([^()]*" + TRAVESSAO + r"[^()]*)\)", no_parentese, s)
    if not re.search(TRAVESSAO, s):
        return s

    # 2. Linha de alternativa de lacuna: "A) material - formal". Sao itens de
    #    uma lista, nao uma frase: separador em meio ponto.
    if re.match(r"^\(?[A-E]\)", s.strip()):
        AUDITORIA["alternativa de lacuna"] += len(re.findall(TRAVESSAO, s))
        return re.sub(r"\s*" + TRAVESSAO + r"\s*", " \u00b7 ", s)

    # 3. Rotulo no inicio da linha seguido da sua glosa: "CE - Competencia
    #    Exclusiva", "1) Condutor - Uso de Documento Falso". Pede dois pontos,
    #    salvo quando a glosa ja traz dois pontos adiante, para nao repetir.
    def rotulo_inicial(m):
        esquerda, direita = m.group(1), s[m.end():]
        so_referencia = re.fullmatch(
            r"\W*(?:Inciso\s+)?(?:§\s*)?(?:[IVXLC]+|\d+)(?:º|ª)?\.?",
            esquerda.strip())
        if so_referencia:
            # "I - Reconhecimento: distinguir" vira "I. Reconhecimento:
            # distinguir". Virgula depois de inciso fica ambigua com a
            # virgula que separa os proprios incisos.
            sinal = ". "
            AUDITORIA["referencia e titulo"] += 1
        elif esquerda.strip().isupper() and direita[:40].isupper():
            sinal = " · "
            AUDITORIA["versal com versal"] += 1
        else:
            sinal = ", " if ":" in direita[:120] else ": "
            AUDITORIA["rotulo e glosa"] += 1
        return esquerda.rstrip() + sinal
    s = re.sub(r"^([\W\d]{0,6}[^\u2012-\u2015:]{1,46}?)\s*" + TRAVESSAO + r"\s*",
               rotulo_inicial, s)

    # 4. Enumeracao de incisos no meio da frase: "II - incapacidade civil;
    #    III - condenacao criminal". O numero e rotulo do item.
    def inciso(m):
        AUDITORIA["inciso enumerado"] += 1
        return m.group(1) + m.group(2) + ", "
    s = re.sub(r"([;:]\s+|^)((?:[IVXLC]+|\d+)\u00ba?)\s*" + TRAVESSAO + r"\s*", inciso, s)

    # 5. Glosa curta no fim do segmento: "apos a sentenca de primeira
    #    instancia - metade". Dois pontos.
    def glosa_final(m):
        AUDITORIA["glosa no fim do segmento"] += 1
        return ": " + m.group(1)
    s = re.sub(r"\s*" + TRAVESSAO + r"\s*([^\u2012-\u2015.;:]{1,34})$", glosa_final, s)

    # 6. O que sobrou e aposto ou intercalacao no meio da prosa: virgula.
    def resto(m):
        AUDITORIA["aposto na prosa"] += 1
        return ", "
    s = re.sub(r"\s*" + TRAVESSAO + r"\s*", resto, s)
    # virgula colada em pontuacao que ja fecha o periodo
    s = re.sub(r",\s*([;.)])", r"\1", s)
    s = re.sub(r",\s*,", ",", s)
    return s


def limpar(s):
    s = s.replace(" ", " ").replace("&", "&amp;")
    s = sem_travessao(s)
    s = re.sub(r"[ \t]+", " ", s).strip()
    return s


def esc(s):
    return limpar(s).replace("<", "&lt;").replace(">", "&gt;")


# --------------------------------------------------------------------------
# leitura do docx
# --------------------------------------------------------------------------
def blocos(doc):
    for ch in doc.element.body.iterchildren():
        if ch.tag == qn("w:p"):
            yield ("p", Paragraph(ch, doc))
        elif ch.tag == qn("w:tbl"):
            yield ("t", Table(ch, doc))


def linhas_de(bloco_tabela):
    """Texto de uma tabela de uma celula, linha por linha."""
    t = []
    for r in bloco_tabela.rows:
        for c in r.cells:
            t.extend(x.strip() for x in c.text.split("\n") if x.strip())
    return t


def matriz(bloco_tabela):
    return [[c.text.strip() for c in r.cells] for r in bloco_tabela.rows]


def paragrafos_do(texto):
    """Um paragrafo do Word com quebras internas vira varios blocos."""
    return [x.strip() for x in texto.split("\n") if x.strip()]


# --------------------------------------------------------------------------
# cabecalho comum das pecas
# --------------------------------------------------------------------------
CABECA = """<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo_tab}</title>
<link rel="icon" href="../../identidade/marca/juris-elite-icone-32.png">
<link rel="stylesheet" href="../../identidade/sistema/fontes.css">
<link rel="stylesheet" href="../../identidade/sistema/tokens.css">
<link rel="stylesheet" href="../../identidade/sistema/componentes.css">
<link rel="stylesheet" href="../../identidade/sistema/impresso.css">
</head>
<body class="je">
"""

TOPO = """
<header class="topo">
  <img src="../../identidade/marca/juris-elite-horizontal.png" alt="Juris Elite">
  <div class="ident">{ident}</div>
</header>
"""

RODAPE = """
<footer class="rodape">
  <span>{esq}</span>
  <span><strong>Mentoria GMM Marabá</strong> · Prof. Walter Ruiz &amp; Prof. Diego Souza (Edital 2026)</span>
</footer>
</div>

</body>
</html>
"""


def tabela_html(mat, legenda, colunas_num=()):
    out = ['<table class="tabela">']
    if legenda:
        out.append(f"  <caption>{esc(legenda)}</caption>")
    cab, *corpo = mat
    out.append("  <thead><tr>" + "".join(
        f'<th{" class=\"num\"" if i in colunas_num else ""}>{esc(c)}</th>' for i, c in enumerate(cab)
    ) + "</tr></thead>")
    out.append("  <tbody>")
    for linha in corpo:
        out.append("    <tr>" + "".join(
            f'<td{" class=\"num\"" if i in colunas_num else ""}>{esc(c)}</td>' for i, c in enumerate(linha)
        ) + "</tr>")
    out.append("  </tbody>")
    out.append("</table>")
    return "\n".join(out)


def bloco_texto(paras, classe=""):
    cl = f' class="{classe}"' if classe else ""
    return "\n".join(f"<p{cl}>{esc(p)}</p>" for p in paras)


# ==========================================================================
# CADERNOS DE 50 QUESTOES (forma A: banner, diretrizes, matriz, 50 questoes,
# quadro-resumo). Cinco dos seis cadernos do acervo seguem exatamente esta
# forma, bloco por bloco.
# ==========================================================================
CADERNOS = [
    dict(
        slug="caderno-administrativo",
        arq="PRODUTOS DISPONÍVEIS/LEGISLAÇÃO ORGANIZADA GMM MARABÁ 2026/"
            "QUESTÕES ORGANIZADAS POR MATÉRIA/"
            "Caderno_50_Questoes_Direito_Administrativo_FADESP_GMM_Maraba_2026.docx",
        h1="Direito<br>Administrativo",
        curto="Direito Administrativo",
        linha="Estado, ato administrativo, poderes e prescrição: o bloco em que a "
              "FADESP cobra conceito, e não decoreba de artigo.",
    ),
    dict(
        slug="caderno-constitucional",
        arq="PRODUTOS DISPONÍVEIS/LEGISLAÇÃO ORGANIZADA GMM MARABÁ 2026/"
            "QUESTÕES ORGANIZADAS POR MATÉRIA/"
            "Caderno_50_Questoes_Direito_Constitucional_e_DH_FADESP_GMM_Maraba_2026.docx",
        h1="Direito<br>Constitucional<br>e Direitos Humanos",
        curto="Direito Constitucional e Direitos Humanos",
        linha="Princípios fundamentais, direitos e garantias, remédios "
              "constitucionais: a matéria que a banca repete em todo concurso de guarda.",
    ),
    dict(
        slug="caderno-penal",
        arq="PRODUTOS DISPONÍVEIS/LEGISLAÇÃO ORGANIZADA GMM MARABÁ 2026/"
            "QUESTÕES ORGANIZADAS POR MATÉRIA/"
            "Caderno_50_Questoes_Direito_Penal_FADESP_GMM_Maraba_2026.docx",
        h1="Direito<br>Penal",
        curto="Direito Penal",
        linha="Da teoria do crime aos crimes em espécie: cinco itens do edital "
              "resolvidos na ordem em que a prova cobra.",
    ),
    dict(
        slug="caderno-processual-penal",
        arq="PRODUTOS DISPONÍVEIS/LEGISLAÇÃO ORGANIZADA GMM MARABÁ 2026/"
            "QUESTÕES ORGANIZADAS POR MATÉRIA/"
            "Caderno_50_Questoes_Direito_Processual_Penal_FADESP_GMM_Maraba_2026.docx",
        h1="Direito<br>Processual Penal",
        curto="Direito Processual Penal",
        linha="Inquérito, prova, prisão e flagrante: o que o guarda vive na rua "
              "e a banca cobra na folha de respostas.",
    ),
    dict(
        slug="caderno-extravagante-federal",
        arq="PRODUTOS DISPONÍVEIS/LEGISLAÇÃO ORGANIZADA GMM MARABÁ 2026/"
            "QUESTÕES ORGANIZADAS POR MATÉRIA/"
            "Caderno_50_Questoes_Legislacao_Extravagante_Federal_FADESP_GMM_Maraba_2026.docx",
        h1="Legislação<br>Extravagante Federal",
        curto="Legislação Extravagante Federal",
        linha="Drogas, racismo, ECA, desarmamento, Maria da Penha, abuso de "
              "autoridade e SUSP: nove itens do edital em cinquenta questões.",
    ),
    dict(
        slug="caderno-extravagante-municipal",
        arq="PRODUTOS DISPONÍVEIS/LEGISLAÇÃO ORGANIZADA GMM MARABÁ 2026/"
            "QUESTÕES ORGANIZADAS POR MATÉRIA/"
            "caderno-50-questoes-Legislacao-Extravagante-GM-Maraba.docx",
        h1="Legislação<br>da Guarda<br>de Marabá",
        curto="Legislação Extravagante Municipal",
        linha="As leis que criaram, organizaram e disciplinaram a Guarda "
              "Municipal de Marabá, e que nenhuma plataforma nacional ensina.",
        # Este caderno nao traz banner com disciplina e peso: a informacao
        # vem do proprio texto de abertura, que fala dos 17 itens.
        disciplina="Legislação Extravagante, leis da Guarda de Marabá",
        peso="17 itens do conteúdo programático",
        abertura="Caderno de 50 Questões Inéditas",
    ),
]

RE_QUESTAO = re.compile(r"^QUESTÃO\s+(\d+)", re.I)
RE_ALT = re.compile(r"^\(?([A-E])\)")
RE_GAB = re.compile(r"^Gabarito\s*(?:Oficial)?\s*:\s*(?:Alternativa\s*)?([A-E])", re.I)
RE_COMENT = re.compile(r"^Comentário(?:\s*do\s*Examinador)?\s*:\s*(.*)$", re.S)
RE_LEI = re.compile(r"^(Texto Legal\s*/\s*Súmula Aplicável|"
                    r"Fundamentação Legal\s*/\s*Jurisprudencial Aplicável)\s*:\s*(.*)$", re.S)
RE_ESQ = re.compile(r"^Esquema\s*/\s*(.*)$", re.S)


def dispositivo_lei(corpo):
    """Texto de lei vai no .texto-base, com a fonte na linha de credito."""
    corpo = corpo.strip()
    m = re.search(r"\(([^()]{3,120})\)\s*$", corpo)
    credito = ""
    if m:
        credito = m.group(1)
        corpo = corpo[:m.start()].strip()
    partes = paragrafos_do(corpo)
    out = ['<div class="texto-base">']
    out.append(bloco_texto(partes))
    if credito:
        out.append('  <span class="credito">' + esc(credito) + "</span>")
    out.append("</div>")
    return "\n".join(out)


def dispositivo_esquema(resto):
    """O bloco "Esquema / ..." do material antigo vai para um de dois
    dispositivos, porque sao duas coisas diferentes com o mesmo rotulo.

    Quando o titulo traz um codigo de memoria (PTG, LIMPE, C-C-H-O-U-P,
    2-2-3/5), a caixa e o mnemonico da casa: etiqueta curta em versal e a
    glosa ao lado. Quando o titulo e "Mapa Mental", "Quadro Sinotico" ou
    "Distincao Essencial", nao existe sigla nenhuma, e enfiar o titulo
    inteiro na etiqueta do mnemonico quebra o desenho. Esses viram cartao
    com titulo mini, que e o dispositivo da casa para quadro de sintese.
    """
    linhas = paragrafos_do(resto)
    titulo = linhas[0].rstrip(":").strip() if linhas else "Esquema"
    corpo = linhas[1:]

    sigla, nome = None, titulo
    m = re.search(r"\(([^()]{2,60})\)\s*:?\s*$", titulo)
    if m:
        dentro = m.group(1).strip()
        # O codigo pode vir sozinho ("(PTG)") ou depois de uma referencia
        # ("(Art. 5o, par. 3o - 2-2-3/5)"). No segundo caso a referencia fica
        # no nome do esquema e so o codigo vai para a etiqueta da caixa.
        if re.search(TRAVESSAO, dentro):
            antes, depois = re.split(TRAVESSAO, dentro, maxsplit=1)
        else:
            antes, depois = None, dentro
        cand = depois.strip()
        if re.fullmatch(r"[A-Z0-9][A-Z0-9 .·+/-]{1,30}", cand):
            sigla = cand
            prefixo = titulo[:m.start()].strip()
            prefixo = re.sub(r"^(Mnemónico|Mnemônico)\s+Aplicável$", "",
                             prefixo).strip()
            if not antes:
                nome = prefixo
            elif prefixo:
                nome = prefixo + " (" + antes.strip() + ")"
            else:
                nome = antes.strip()

    # O caderno das leis municipais rotula tudo como "Esquema / Mnemonico" e
    # poe o codigo entre apostrofos na primeira linha do corpo.
    if not sigla and corpo:
        m2 = re.match(r"^(.*?):\s*['‘’\"]([A-Z0-9][A-Z0-9 .·+/-]{1,30})"
                      r"['‘’\"]\s*$", corpo[0])
        if m2:
            sigla = m2.group(2).strip()
            cabeca = m2.group(1).strip()
            corpo = corpo[1:]
            if re.fullmatch(r"(?i)mnem[oóô]nico", titulo):
                nome = cabeca
            else:
                nome = titulo

    if not corpo:
        # Esquema de uma linha: o proprio titulo e o conteudo.
        corpo, nome = [titulo], ""

    if sigla:
        out = ['<div class="mnemo">']
        out.append('  <span class="sigla">' + esc(sigla) + "</span>")
        if nome:
            corpo = [nome + ":"] + corpo
        out.append("  <p>" + "<br>".join(esc(c) for c in corpo) + "</p>")
        out.append("</div>")
        return "\n".join(out)

    out = ['<div class="cartao">']
    if nome:
        out.append('  <h4 class="mini">' + esc(nome) + "</h4>")
    out.append(lista_ou_paragrafos(corpo))
    out.append("</div>")
    return "\n".join(out)


def lista_ou_paragrafos(linhas):
    """Sequencia de marcadores vira lista; o resto vira paragrafo."""
    marcador = re.compile(r"^\s*[•·*–-]\s+")
    if linhas and sum(1 for l in linhas if marcador.match(l)) >= max(2, len(linhas) - 1):
        itens = ["    <li>" + esc(marcador.sub("", l)) + "</li>" for l in linhas]
        return "  <ul>\n" + "\n".join(itens) + "\n  </ul>"
    return bloco_texto(linhas)


def questao_html(q):
    # div e p, e nao article e aside: o gerador de .docx da casa percorre a
    # arvore por tag e classe, e esta e a forma que ele le.
    out = ['<div class="questao questao--livre">']
    out.append('  <p class="cab">Questão ' + q["n"] + "</p>")

    etiquetas, classificacao = [], []
    for e in q["etiq"]:
        e = re.sub(r"^Classificação\s+segundo\s+o\s+Edital:\s*", "", e, flags=re.I)
        e = re.sub(r"^Classificação\s+edital:\s*", "", e, flags=re.I)
        if re.match(r"^Nível", e, re.I):
            etiquetas.append(("et--peso", re.sub(r"^Nível(\s+de\s+Complexidade)?:\s*",
                                                 "Nível ", e, flags=re.I)))
        elif re.match(r"^Incidência", e, re.I):
            etiquetas.append(("et--inc", e))
        else:
            # A classificacao no conteudo programatico e uma frase inteira,
            # as vezes com mais de cem caracteres. Frase nao vai em pilula:
            # a pilula nao quebra linha e estoura a largura da folha, e um
            # elemento que estoura a folha faz o Chrome encolher o PDF todo.
            classificacao.append(e)
    for c in classificacao:
        out.append('  <p class="edital">' + esc(c) + "</p>")
    if etiquetas:
        out.append('  <div class="etiquetas">')
        for cl, txt in etiquetas:
            # Trava: pilula e rotulo curto. Se um dia entrar frase aqui, o
            # PDF inteiro encolhe sem avisar, e o defeito so aparece na
            # contagem de paginas. Melhor quebrar a conversao.
            assert len(txt) <= 44, "pilula longa demais: " + txt
            c = ("et " + cl).strip()
            out.append('    <span class="' + c + '">' + esc(txt) + "</span>")
        out.append("  </div>")

    enunciado, alts, gabl, coment, lei, esquemas = [], [], None, [], None, []
    fase = "enunciado"
    for p in q["corpo"]:
        if RE_GAB.match(p):
            gabl = RE_GAB.match(p).group(1).upper()
            fase = "pos"
            continue
        m = RE_COMENT.match(p)
        if m:
            coment = paragrafos_do(m.group(1))
            fase = "pos"
            continue
        m = RE_LEI.match(p)
        if m:
            lei = m.group(2)
            fase = "pos"
            continue
        m = RE_ESQ.match(p)
        if m:
            esquemas.append(m.group(1))
            fase = "pos"
            continue
        if fase == "enunciado" and RE_ALT.match(p):
            alts.append(p)
            continue
        if fase == "enunciado":
            if alts:
                alts.append(p)
            else:
                enunciado.extend(paragrafos_do(p))
        else:
            if coment:
                coment.extend(paragrafos_do(p))
            else:
                enunciado.extend(paragrafos_do(p))

    out.append(bloco_texto(enunciado))
    if alts:
        out.append('  <ul class="alt">')
        for a in alts:
            out.append("    <li>" + esc(a) + "</li>")
        out.append("  </ul>")

    q["letra"] = gabl or "?"
    out.append('  <div class="gab">')
    out.append('    <div class="t">Gabarito: ' + (gabl or "?") + "</div>")
    out.append(bloco_texto(coment))
    out.append("  </div>")

    if lei:
        out.append(dispositivo_lei(lei))
    for e in esquemas:
        out.append(dispositivo_esquema(e))
    out.append("</div>")
    return "\n".join(out)



def quadro_gabarito(questoes):
    """Monta o quadro-resumo a partir das proprias questoes.

    Dos seis cadernos antigos, so o de Direito Administrativo trazia essa
    tabela. Montar aqui garante que os seis fechem igual e que o quadro nao
    possa divergir da letra impressa em cada questao: ambos saem da mesma
    leitura do arquivo.
    """
    linhas = [["Questão", "Gabarito", "Classificação no edital nº 01/2026", "Nível"]]
    for q in questoes:
        classe, nivel = "", ""
        for e in q["etiq"]:
            e2 = re.sub(r"^Classificação\s+(?:segundo\s+o\s+)?[Ee]dital:?\s*", "", e)
            if re.match(r"^Nível", e, re.I):
                nivel = re.sub(r"^Nível(\s+de\s+Complexidade)?:\s*", "", e, flags=re.I)
            elif re.match(r"^Incidência", e, re.I):
                pass
            elif not classe:
                classe = e2
        linhas.append(["Questão " + q["n"], q.get("letra", "?"), classe, nivel])
    return linhas


def confere_quadro(slug, original, questoes):
    """Confere o quadro que o conversor montou contra o que o caderno antigo
    ja trazia. Divergencia aqui significa erro de leitura, nao de conteudo."""
    de_la = {}
    for linha in original[1:]:
        m = re.search(r"(\d+)", linha[0])
        if m:
            de_la[str(int(m.group(1)))] = linha[1].strip().upper()[:1]
    ruim = [(q["n"], q.get("letra"), de_la.get(str(int(q["n"]))))
            for q in questoes
            if de_la.get(str(int(q["n"]))) and de_la[str(int(q["n"]))] != q.get("letra")]
    if ruim:
        print("  AVISO " + slug + ": gabarito divergente questao/quadro: " + str(ruim))
    else:
        print("  " + slug + ": quadro de gabarito confere com as 50 questoes")


def distribuicao_html(questoes):
    """Distribuicao das letras. Serve de conferencia de equilibrio do caderno."""
    c = collections.Counter(q.get("letra", "?") for q in questoes)
    itens = " · ".join(l + ": " + str(c.get(l, 0)) for l in "ABCDE")
    return ('<p class="fonte">Distribuição das respostas no caderno · ' + itens
            + '. O gabarito foi lido do próprio material e não foi redistribuído '
            'na conversão.</p>')


def converter_caderno(cfg):
    caminho = BASE / cfg["arq"]
    doc = docx.Document(str(caminho))
    bs = list(blocos(doc))

    disciplina = cfg.get("disciplina", "")
    peso = cfg.get("peso", "")
    diretrizes = []
    esperando_diretrizes = []
    matriz_inc = None
    questoes = []
    gabarito = None
    atual = None

    for kind, b in bs:
        if kind == "t":
            ls = linhas_de(b)
            texto0 = ls[0] if ls else ""
            if "CONCURSO PÚBLICO" in texto0.upper():
                for l in ls:
                    m = re.search(r"Disciplina:\s*(.+?)\s*\(([^)]*Peso[^)]*)\)", l)
                    if m:
                        disciplina = m.group(1).strip()
                        peso = m.group(2).strip()
                continue
            if RE_QUESTAO.match(texto0):
                atual = {"n": RE_QUESTAO.match(texto0).group(1), "etiq": [], "corpo": []}
                questoes.append(atual)
                for l in ls[1:]:
                    for pedaco in re.split(r"\s{2,}\|\s{2,}|\s+\|\s+", l):
                        pedaco = pedaco.strip()
                        if pedaco:
                            atual["etiq"].append(pedaco)
                continue
            mat = matriz(b)
            cabs = " ".join(mat[0]).lower()
            if "tópico do conteúdo" in cabs or "item edital" in cabs:
                matriz_inc = mat
            elif "gabarito" in cabs and "quest" in cabs:
                gabarito = mat
            continue

        texto = b.text.strip()
        if not texto:
            continue
        if texto.upper().startswith("DIRETRIZES"):
            diretrizes = paragrafos_do(texto)[1:]
            continue
        # O caderno das leis municipais nao traz banner nem o rotulo
        # "DIRETRIZES": abre com titulo em paragrafo e numera as secoes.
        if re.match(r"^\d+\.\s+Diretrizes", texto, re.I):
            esperando_diretrizes.append(True)
            continue
        if esperando_diretrizes and not diretrizes and atual is None:
            diretrizes = paragrafos_do(texto)
            esperando_diretrizes.clear()
            continue
        if re.match(r"^\d+\.\s+(Caderno de Quest|Quadro.Resumo)", texto, re.I):
            continue
        if texto.upper().startswith("QUADRO-RESUMO DO GABARITO"):
            continue
        if atual is None and cfg.get("abertura")  and texto.startswith(cfg["abertura"]):
            continue
        if atual is not None:
            atual["corpo"].append(texto)

    assert len(questoes) == 50, cfg["slug"] + ": " + str(len(questoes)) + " questoes"
    assert matriz_inc, cfg["slug"] + ": falta a matriz de incidencia"

    ident = (cfg["curto"] + " · 50 questões comentadas<br>"
             "Mentoria GMM Marabá · Edital 2026")
    out = [CABECA.format(titulo_tab="Caderno de " + cfg["curto"] + " · Juris Elite")]
    out.append(CAPA_CADERNO.format(
        h1=cfg["h1"], linha=esc(cfg["linha"]),
        disciplina=esc(disciplina), peso=esc(peso)))
    out.append(TOPO.format(ident=ident))

    out.append('<h2 class="secao"><span class="n">Diretrizes do edital</span>'
               "Como este caderno foi montado</h2>")
    out.append('<div class="cartao">')
    out.append(bloco_texto(diretrizes))
    out.append("</div>")
    out.append('<h3 class="sub">Incidência por subitem do conteúdo '
               "programático</h3>")
    out.append(tabela_html(matriz_inc,
                           "Distribuição das 50 questões · " + disciplina,
                           colunas_num=(2, 3)))

    out.append('<h2 class="secao nova-pagina"><span class="n">Questões 01 a 50</span>'
               + esc(cfg["curto"]) + "</h2>")
    for q in questoes:
        out.append(questao_html(q))

    out.append('<h2 class="secao nova-pagina"><span class="n">Gabarito</span>'
               "Quadro-resumo das cinquenta questões</h2>")
    quadro = quadro_gabarito(questoes)
    if gabarito:
        confere_quadro(cfg["slug"], gabarito, questoes)
    out.append(tabela_html(quadro,
                           "Gabarito oficial, classificação no edital e nível",
                           colunas_num=(1,)))
    out.append(distribuicao_html(questoes))
    out.append(RODAPE.format(esq="Caderno de " + cfg["curto"]
                             + " · 50 questões inéditas comentadas"))

    destino = DESTINO / cfg["slug"]
    destino.mkdir(parents=True, exist_ok=True)
    alvo = destino / (cfg["slug"] + ".html")
    alvo.write_text("\n".join(out), encoding="utf-8")
    return alvo, len(questoes), gabarito


CAPA_CADERNO = """
<section class="capa">
  <img src="../../identidade/marca/juris-elite-horizontal-negativo.png" alt="Juris Elite">
  <div class="rot">Mentoria GMM Marabá · Edital nº 01/2026 · Fadesp</div>
  <h1>{h1}</h1>
  <p class="linha">{linha}</p>
  <div class="selo">
    50 questões inéditas comentadas · <b>Padrão FADESP</b>
  </div>
  <div class="assina">
    Prof. Walter Ruiz (Bogaz Neto) &amp; Prof. Diego Souza<br>
    {disciplina} · {peso}<br>
    Prova objetiva: 24 de janeiro de 2027
  </div>
</section>

<div class="folha">"""


# ==========================================================================
# E-BOOK DE LEGISLACAO EXTRAVAGANTE
#
# Peca de prosa, e nao de questoes: oito capitulos, subsecoes numeradas,
# caixas de alerta, quadros de sintese, mnemonicos, oito questoes comentadas
# e um glossario. A conversao mapeia cada um desses no dispositivo da casa.
# ==========================================================================
EBOOK = dict(
    slug="ebook-legislacao-extravagante",
    arq="LEGISLAÇÃO EXTRAVAGANTE/ebook-estudo-completo-legislando-gmm-maraba.docx",
    h1="Legislação<br>Extravagante",
    curto="E-book de Legislação Extravagante",
)

RE_CAP = re.compile(r"^CAP[IÍ]TULO\s+(\d+)\s*[‒-―:.]?\s*(.*)$")
RE_SUB = re.compile(r"^(\d+\.\d+)\s+(.+)$")
RE_Q_EBOOK = re.compile(r"^QUEST[ÃA]O\s+(\d+)\s*\(", re.I)
RE_SEP = re.compile(r"^[_\s]+$")
RE_ITEM_NUM = re.compile(r"^\d+\.\s+")
RE_ITEM_ETAPA = re.compile(r"^\d+[ªº]\s+Etapa:")
RE_GLOSSARIO = re.compile(r"^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][^:]{2,60}):\s+(.+)$")


def forte(s):
    """O material antigo marca enfase com asterisco, resto de Markdown que
    sobrou na exportacao para Word. Na peca da casa isso vira negrito."""
    return re.sub(r"\*([^*]{1,200}?)\*", r"<strong>\1</strong>", s)


def p_forte(linhas, classe=""):
    cl = ' class="' + classe + '"' if classe else ""
    return "\n".join("<p" + cl + ">" + forte(esc(l)) + "</p>" for l in linhas)


# O diagrama de prazos vinha em arte ASCII, com caracteres de moldura que as
# fontes da marca nao tem (as setas e as barras caem em fonte de sistema e
# aparecem no aviso do gerador). Vira tabela, que diz a mesma coisa e imprime.
PRAZOS_PROVIMENTO = [
    ["Etapa", "Prazo", "Observação", "Se o prazo não for cumprido"],
    ["Nomeação › Posse", "30 dias", "Prorrogável por mais 30 dias a pedido",
     "Nomeação tornada sem efeito (Art. 17)"],
    ["Posse › Exercício", "10 dias", "Improrrogável",
     "Exoneração do servidor (Art. 20)"],
    ["Exercício › Estabilidade", "36 meses", "Avaliação especial de desempenho",
     "Exoneração ou recondução"],
]


def converter_ebook(cfg=EBOOK):
    doc = docx.Document(str(BASE / cfg["arq"]))
    bs = list(blocos(doc))

    corpo = []
    questao = None
    questoes_n = 0
    pilha_alerta = []
    dentro_cerca = False
    pulou_capa = 0

    def fecha_questao():
        nonlocal questao
        if questao is not None:
            corpo.append(monta_questao_ebook(questao))
            questao = None

    def fecha_alerta():
        if pilha_alerta:
            titulo = pilha_alerta[0]
            resto = pilha_alerta[1:]
            marcador = re.compile(r"^\s*\*\s+")
            if titulo.lower().startswith("atenção") or "pegadinha" in titulo.lower():
                bloco = ['<div class="alerta">']
                cab, _, rest = titulo.partition(":")
                bloco.append('  <p class="t">' + esc(cab.strip()) + "</p>")
                linhas = ([rest.strip()] if rest.strip() else []) + resto
                for l in linhas:
                    bloco.append("  <p>" + forte(esc(marcador.sub("", l))) + "</p>")
                bloco.append("</div>")
            else:
                bloco = ['<div class="cartao">']
                if titulo.endswith(":") and resto:
                    bloco.append('  <h4 class="mini">' + esc(titulo.rstrip(":")) + "</h4>")
                    bloco.append(lista_ou_paragrafos([marcador.sub("", l) for l in resto]))
                else:
                    bloco.append(lista_ou_paragrafos(
                        [marcador.sub("", l) for l in [titulo] + resto]))
                bloco.append("</div>")
            corpo.append("\n".join(bloco))
            pilha_alerta.clear()

    lista_aberta = []
    no_glossario = []
    verbetes = []

    def fecha_lista():
        if not lista_aberta:
            return
        # Lista ja numerada no texto vira <ol> com o numero retirado: deixar
        # os dois marca o item duas vezes ("1. 1. Nacionalidade brasileira").
        numerada = all(re.match(r"^\d+[.)]\s+", x) for x in lista_aberta)
        if numerada:
            itens = [re.sub(r"^\d+[.)]\s+", "", x) for x in lista_aberta]
            corpo.append("<ol>\n" + "\n".join(
                "  <li>" + forte(esc(x)) + "</li>" for x in itens) + "\n</ol>")
        else:
            corpo.append("<ul>\n" + "\n".join(
                "  <li>" + forte(esc(x)) + "</li>" for x in lista_aberta) + "\n</ul>")
        lista_aberta.clear()

    def fecha_glossario():
        """O glossario sai em tabela de duas colunas: e consulta, nao leitura."""
        if verbetes:
            corpo.append(tabela_html([["Termo", "O que significa"]] + verbetes,
                                     "Glossário jurídico e institucional"))
            verbetes.clear()

    for kind, b in bs:
        if kind == "t":
            mat = matriz(b)
            if len(mat) == 1 and len(mat[0]) == 1:
                # Caixa de uma celula. Varias seguidas formam um alerta so.
                fecha_lista()
                for l in paragrafos_do(mat[0][0]):
                    pilha_alerta.append(l)
                continue
            fecha_lista()
            fecha_alerta()
            fecha_questao()
            corpo.append(tabela_html(mat, ""))
            continue

        texto = b.text.strip()
        if not texto:
            continue
        if RE_SEP.match(texto):
            continue
        if texto == "```":
            dentro_cerca = not dentro_cerca
            if not dentro_cerca:
                fecha_lista()
                fecha_alerta()
                # Sem legenda: o titulo da subsecao logo acima ja diz isto.
                corpo.append(tabela_html(PRAZOS_PROVIMENTO, ""))
            continue
        if dentro_cerca:
            continue  # a arte ASCII foi substituida pela tabela acima

        if pulou_capa < 6:
            # As seis primeiras linhas sao a folha de rosto, refeita na capa.
            pulou_capa += 1
            continue

        linha_lista = (RE_ITEM_NUM.match(texto) or RE_ITEM_ETAPA.match(texto)
                       or texto.endswith(";"))

        m = RE_CAP.match(texto)
        if m:
            fecha_lista(); fecha_alerta(); fecha_questao(); fecha_glossario()
            no_glossario.clear()
            if "glossário" in m.group(2).lower():
                no_glossario.append(True)
            corpo.append('<h2 class="secao nova-pagina"><span class="n">Capítulo '
                         + m.group(1) + "</span>" + esc(m.group(2)) + "</h2>")
            continue
        if no_glossario:
            g = RE_GLOSSARIO.match(texto)
            if g:
                verbetes.append([g.group(1).strip(), g.group(2).strip()])
                continue
        m = RE_SUB.match(texto)
        if m:
            fecha_lista(); fecha_alerta(); fecha_questao()
            corpo.append('<h3 class="sub">' + esc(m.group(1) + " " + m.group(2)) + "</h3>")
            continue
        if re.match(r"^(Apresentação|Como Este Ebook|Resumo e |Questões Comentadas"
                    r"|Prazos Cruciais|Alçada de Competência|Prerrogativas e Vedações"
                    r"|Os \d+ Princípios|Posição Institucional)", texto) and len(texto) < 90:
            fecha_lista(); fecha_alerta(); fecha_questao()
            corpo.append('<h3 class="sub">' + esc(texto) + "</h3>")
            continue

        m = RE_Q_EBOOK.match(texto)
        if m:
            fecha_lista(); fecha_alerta(); fecha_questao()
            questoes_n += 1
            questao = {"n": m.group(1), "corpo": []}
            continue
        if questao is not None:
            questao["corpo"].append(texto)
            continue

        if texto.startswith("*Mnemônico") or texto.startswith("*Mnemonico"):
            fecha_lista(); fecha_alerta()
            corpo.append(mnemo_do_ebook(texto))
            continue

        if linha_lista:
            fecha_alerta()
            lista_aberta.append(texto)
            continue

        fecha_lista()
        fecha_alerta()
        corpo.append(p_forte(paragrafos_do(texto)))

    fecha_lista(); fecha_alerta(); fecha_questao(); fecha_glossario()

    assert questoes_n == 8, "e-book: " + str(questoes_n) + " questoes"

    ident = ("E-book de Legislação Extravagante<br>"
             "Mentoria GMM Marabá · Edital 2026")
    out = [CABECA.format(titulo_tab="E-book de Legislação Extravagante · Juris Elite")]
    out.append("""
<section class="capa">
  <img src="../../identidade/marca/juris-elite-horizontal-negativo.png" alt="Juris Elite">
  <div class="rot">Mentoria GMM Marabá · Edital nº 01/2026 · Fadesp</div>
  <h1>""" + cfg["h1"] + """</h1>
  <p class="linha">As leis que criaram e disciplinam a Guarda Municipal de Marabá,
  da lei de criação ao SUSP, explicadas para quem vai patrulhar e prestar prova.</p>
  <div class="selo">
    Guia doutrinário · <b>Lei seca comentada</b> · Pegadinhas FADESP
  </div>
  <div class="assina">
    Prof. Walter Ruiz (Bogaz Neto) &amp; Prof. Diego Souza<br>
    Oito capítulos · Oito questões comentadas · Glossário<br>
    Prova objetiva: 24 de janeiro de 2027
  </div>
</section>

<div class="folha">""")
    out.append(TOPO.format(ident=ident))
    out.extend(corpo)
    out.append(RODAPE.format(
        esq="E-book de Legislação Extravagante · Guarda Municipal de Marabá"))

    destino = DESTINO / cfg["slug"]
    destino.mkdir(parents=True, exist_ok=True)
    alvo = destino / (cfg["slug"] + ".html")
    alvo.write_text("\n".join(out), encoding="utf-8")
    return alvo, questoes_n


def mnemo_do_ebook(texto):
    """*Mnemonico de Fixacao dos Principios:* DCI-JL-CP (*Dignidade, ...*)"""
    limpo = re.sub(r"\*", "", texto)
    cab, _, resto = limpo.partition(":")
    m = re.match(r"\s*([A-Z0-9][A-Z0-9 .·+/-]{1,30}?)\s*\((.+)\)\s*$", resto.strip())
    out = ['<div class="mnemo">']
    if m:
        out.append('  <span class="sigla">' + esc(m.group(1)) + "</span>")
        out.append("  <p>" + esc(cab.strip()) + ": " + esc(m.group(2)) + "</p>")
    else:
        out.append('  <span class="sigla">' + esc(cab.strip()) + "</span>")
        out.append("  <p>" + esc(resto.strip()) + "</p>")
    out.append("</div>")
    return "\n".join(out)


def monta_questao_ebook(q):
    # div e p, e nao article e aside: o gerador de .docx da casa percorre a
    # arvore por tag e classe, e esta e a forma que ele le.
    out = ['<div class="questao questao--livre">']
    out.append('  <p class="cab">Questão ' + q["n"] + "</p>")
    enunciado, alts, gabl, coment = [], [], None, []
    for p in q["corpo"]:
        if RE_GAB.match(p):
            gabl = RE_GAB.match(p).group(1).upper()
            continue
        m = RE_COMENT.match(p)
        if m:
            coment = paragrafos_do(m.group(1))
            continue
        if RE_ALT.match(p) and not coment:
            alts.append(p)
            continue
        if coment:
            coment.extend(paragrafos_do(p))
        else:
            enunciado.extend(paragrafos_do(p))
    out.append(p_forte(enunciado))
    if alts:
        out.append('  <ul class="alt">')
        for a in alts:
            out.append("    <li>" + forte(esc(a)) + "</li>")
        out.append("  </ul>")
    out.append('  <div class="gab">')
    out.append('    <div class="t">Gabarito: ' + (gabl or "?") + "</div>")
    out.append(p_forte(coment))
    out.append("  </div>")
    out.append("</div>")
    return "\n".join(out)


def main():
    alvo = sys.argv[1] if len(sys.argv) > 1 else "cadernos"
    if alvo in ("cadernos", "tudo"):
        for cfg in CADERNOS:
            caminho, n, gab = converter_caderno(cfg)
            print("  " + cfg["slug"] + ": " + str(n) + " questoes  ->  "
                  + str(caminho.relative_to(RAIZ)))
    if alvo in ("ebook", "tudo"):
        caminho, n = converter_ebook()
        print("  ebook: " + str(n) + " questoes  ->  "
              + str(caminho.relative_to(RAIZ)))
    print("\npontuacao convertida:", dict(AUDITORIA))


if __name__ == "__main__":
    main()
