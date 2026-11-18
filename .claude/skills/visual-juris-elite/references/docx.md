# Peças em DOCX

Vale para caderno de questões, e-book, apostila, lista de exercícios e todo
arquivo Word que **o aluno abre na máquina dele**.

## A regra que muda tudo

Um `.docx` renderiza com as fontes da máquina de quem abre. Playfair Display e
Source Serif 4 **não existem** na máquina do aluno: o Word substitui por outra
coisa e a peça chega descaracterizada.

| Entrega | Fontes |
|---|---|
| `.docx` que o aluno abre e edita | **Cambria** (título e corpo) + **Calibri** (rótulo, tabela, legenda) |
| `.docx` que nós convertemos em PDF antes de entregar | fontes da marca, se instaladas; senão Cambria/Calibri |

Cambria e Calibri acompanham o Office em Windows e Mac, então a peça chega
igual. A identidade, nesse suporte, é carregada pela **marca, pela cor e pela
estrutura** — não pela fonte.

## Mapeamento de estilo

| Papel | Fonte | Corpo | Cor | Observação |
|---|---|---|---|---|
| Título 1 | Cambria Bold | 20 pt | `#10283F` | filete de ouro abaixo |
| Título 2 | Cambria Bold | 15 pt | `#10283F` | |
| Rótulo de seção | Calibri Bold | 9 pt | `#7B6338` | versal, entreletra ampliada |
| Corpo | Cambria | 11,5 pt | `#24282C` | entrelinha 1,4; espaço 6 pt depois |
| Tabela — cabeçalho | Calibri Bold | 10 pt | `#F4F0E8` sobre `#10283F` | |
| Tabela — célula | Calibri | 10 pt | `#24282C` | zebra `#F4F0E8` |
| Legenda | Calibri | 9 pt | `#55606B` | |
| Rodapé | Calibri | 8 pt | `#55606B` | assinatura da casa |

Margens: 2,5 cm em cima e embaixo, 2,2 cm nas laterais. Coluna única.

## Receita em python-docx

```python
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

MARINHO = RGBColor(0x10, 0x28, 0x3F)
OURO_TEXTO = RGBColor(0x7B, 0x63, 0x38)
GRAFITE = RGBColor(0x24, 0x28, 0x2C)
SUAVE = RGBColor(0x55, 0x60, 0x6B)

def sombrear(celula, hexa):
    """Preenche o fundo de uma célula; python-docx não expõe isso."""
    tc = celula._tc.get_or_add_tcPr()
    sh = OxmlElement("w:shd")
    sh.set(qn("w:val"), "clear")
    sh.set(qn("w:fill"), hexa)
    tc.append(sh)

def filete(doc, cor="B89A63", largura=18):
    """Filete de ouro: parágrafo vazio com borda inferior."""
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    pPr = p._p.get_or_add_pPr()
    bordas = OxmlElement("w:pBdr")
    b = OxmlElement("w:bottom")
    b.set(qn("w:val"), "single")
    b.set(qn("w:sz"), str(largura))   # oitavos de ponto
    b.set(qn("w:space"), "1")
    b.set(qn("w:color"), cor)
    bordas.append(b)
    pPr.append(bordas)
    return p

def rotulo(doc, texto):
    p = doc.add_paragraph()
    r = p.add_run(texto.upper())
    r.font.name = "Calibri"; r.font.size = Pt(9); r.font.bold = True
    r.font.color.rgb = OURO_TEXTO
    r._element.rPr.rFonts.set(qn("w:cs"), "Calibri")
    # entreletra de 1,2 pt = 24 vigésimos
    esp = OxmlElement("w:spacing"); esp.set(qn("w:val"), "24")
    r._element.rPr.append(esp)
    p.paragraph_format.space_after = Pt(2)
    return p
```

Defina os estilos **uma vez** em `styles` e aplique por nome; não formate run a
run no corpo do documento.

```python
doc = Document()
st = doc.styles["Normal"]
st.font.name = "Cambria"; st.font.size = Pt(11.5); st.font.color.rgb = GRAFITE
st.element.rPr.rFonts.set(qn("w:eastAsia"), "Cambria")
st.paragraph_format.line_spacing = 1.4
st.paragraph_format.space_after = Pt(6)
for s in doc.sections:
    s.top_margin = s.bottom_margin = Cm(2.5)
    s.left_margin = s.right_margin = Cm(2.2)
```

## Estrutura fixa do caderno de 50 questões

Não altere a ordem; é o formato que os alunos já conhecem.

1. Logotipo (`juris-elite-horizontal.png`, 4,5 cm de largura) e, abaixo,
   `CADERNO DE 50 QUESTÕES INÉDITAS COMENTADAS — PADRÃO FADESP`.
2. Linha `Disciplina: X (Itens N a M — Peso P)`.
3. Seção `DIRETRIZES DO EDITAL`, explicando o método.
4. **Tabela de incidência percentual por subitem** do conteúdo programático.
5. As questões. Cada uma abre com
   `QUESTÃO NN (Inédita — 2026 — Padrão FADESP)` e traz, em linha de etiquetas,
   `Classificação segundo o Edital`, `Nível de Complexidade` e
   `Incidência FADESP`. Cinco alternativas, A a E.
6. Gabarito comentado, com o artigo que resolve.
7. Rodapé de assinatura da casa.

Taxonomia FADESP a reproduzir nos enunciados: enunciado incompleto, julgamento
de proposições I–IV, caso operacional ambientado em Marabá, comando reverso
(INCORRETO / EXCETO) e preenchimento de lacunas.

## Logotipo no DOCX

```python
from docx.shared import Cm
doc.add_picture("identidade/marca/juris-elite-horizontal.png", width=Cm(4.5))
```

Para cabeçalho de todas as páginas, insira na `section.header`, não no corpo.
Fundo claro usa a variante padrão; só use a negativa se houver bloco marinho
atrás, o que no Word é trabalhoso — prefira a padrão.

## Antes de entregar

- Abra o arquivo e confira que nenhuma tabela estourou a margem.
- Confira que o sumário (se houver) bate com os títulos.
- Converta uma cópia em PDF e folheie: é nele que o erro aparece.
- Nenhum dado pessoal de professor no arquivo (checar propriedades do
  documento: autor, empresa, último salvo por).
