---
name: visual-juris-elite
description: Use SEMPRE que for criar, formatar ou refazer qualquer peça da Juris Elite — caderno de questões, e-book, apostila, resumo, mapa de pontos, emenda, exercício, cronograma, simulado, gabarito comentado, landing page, criativo de anúncio, capa, certificado, proposta ou documento institucional. Acione em "cria o caderno", "monta o material", "gera o PDF", "faz a capa", "aplica a identidade", "põe no padrão da Juris Elite", "formata isso", "faz o criativo", "material da Mentoria GMM". Produz peças em HTML/PDF ou DOCX com a marca, a paleta e os dispositivos didáticos da casa.
---

# Identidade visual da Juris Elite

A Juris Elite é a marca-casa. **Mentoria GMM Marabá** é linha de produto dentro
dela, e assim deve ser assinada — nunca como marca concorrente. Professores:
**Prof. Walter Ruiz (Bogaz Neto)** e **Prof. Diego Souza**.

Antes de produzir qualquer peça, leia o arquivo de referência que corresponde ao
suporte:

| Suporte | Leia |
|---|---|
| HTML, landing, PDF que nós renderizamos | `references/web-e-pdf.md` |
| DOCX entregue ao aluno | `references/docx.md` |
| Dúvida de cor, contraste ou tipografia | `references/paleta-e-tipografia.md` |

## O essencial, que vale em todo suporte

**Cor.** Marinho `#10283F` é a cor-mãe: fundo institucional, título, cabeçalho de
tabela. Ouro `#B89A63` é a assinatura: filete, monograma, selo, borda — e **nunca
texto em fundo claro** (reprova em contraste; para texto use `#7B6338`). Creme
`#F4F0E8` é o papel. Âmbar `#E4A139` é ação e urgência, reservado a CTA, anúncio
e contagem regressiva — fora disso, não aparece.

**Tipografia.** Display `Playfair Display` só em título e capa. Leitura
`Source Serif 4` no corpo de material impresso. Interface `Inter` em rótulo,
tabela, legenda e botão. No DOCX entregue ao aluno, valem os substitutos seguros
de `references/docx.md`, porque o arquivo renderiza na máquina dele.

**Marca.** Use sempre os arquivos de `identidade/marca/`, nunca redesenhe o logotipo
nem o reescreva em texto. Sobre fundo claro, `juris-elite-horizontal.png`; sobre
marinho, `...-negativo.png`; em uma cor só, as versões mono. Respiro mínimo em
volta da marca: a altura do monograma. Altura mínima útil: 24 px em tela, 12 mm
impresso. Abaixo disso, use só o monograma.

**Filete de ouro.** É o gesto gráfico da casa: uma régua de 3 px em ouro abaixo do
rótulo de seção ou acima do rodapé. Separa, não decora. Uma por bloco.

## Dispositivos didáticos da casa

Material novo não inventa dispositivo. Reproduz estes, que já existem nos
cadernos e no e-book:

- **Alerta de Pegadinha FADESP** — caixa com filete vermelho `#C0392B` à
  esquerda, título em versal, e o erro que a banca induz.
- **Mnemônico de Fixação** — caixa com borda de ouro e a sigla em display.
- **Tabela de incidência percentual** por subitem do conteúdo programático.
  É o Mapa de Pontos aplicado dentro da matéria; toda apostila leva a sua.
- **Questão inédita comentada** — cabeçalho com número, "Classificação segundo o
  Edital", "Nível de Complexidade" e "Incidência FADESP"; cinco alternativas A–E;
  gabarito em caixa verde ao final.
- **Citação ancorada** — todo argumento preso a artigo e, quando couber,
  jurisprudência. Nunca afirmação de direito sem dispositivo.

## Voz

Direta e anti-juridiquês. O leitor é tratado como "futuro(a) Guarda Municipal"
(ou o cargo da linha). Traduza a norma para a rotina do cargo. Nada de prolixidade
formal, nada de promessa de aprovação, nada de consultoria jurídica individual.

## Assinatura e rodapé

Rodapé de toda peça, em uma linha:

> Juris Elite · Mentoria GMM Marabá · Prof. Walter Ruiz e Prof. Diego Souza · Edital 01/2026-GMM

Material da linha GMM traz ainda o corte normativo quando citar legislação:
nada posterior a **11/11/2026**, por força do subitem 24.12 do edital.

## Antes de entregar, confira

1. A marca está em arquivo de `identidade/marca/`, na variante certa para o fundo.
2. Nenhum texto em `#B89A63` sobre fundo claro.
3. Âmbar só em chamada para ação.
4. Toda tabela tem legenda em versal e cabeçalho marinho.
5. Toda afirmação jurídica tem artigo.
6. O rodapé de assinatura está presente.
7. Em PDF, as cores de fundo imprimem (`print-color-adjust: exact`).
7.1. O PDF foi gerado por `python identidade/sistema/gerar-pdf.py <peça>.html`, e
   o aviso de fonte no final não apontou família fora da marca. Chrome aberto
   direto no `file://` produz PDF em fonte de sistema, sem avisar.
7.2. **Nada estoura a largura da folha.** Elemento mais largo que a folha faz o
   Chrome encolher a peça INTEIRA para caber, e o PDF sai com tipo menor e
   menos páginas, sem erro nenhum na tela nem no gerador. O suspeito de sempre
   é a pílula `.et`, que tem `white-space: nowrap`: rótulo curto cabe, frase
   não. Confira com a peça aberta em 794px de largura:
   `[...document.querySelectorAll('.folha *')].filter(n => n.scrollWidth > document.querySelector('.folha').clientWidth)`
   deve voltar vazio. Paginação muito diferente entre peças de volume parecido
   é o sintoma.
7.3. A paginação foi conferida: número de páginas compatível com o volume de
   texto, e nenhuma página pela metade. `break-inside: avoid` em bloco mais
   alto que meia folha empurra o bloco inteiro e deixa vão atrás; questão
   comentada longa usa `.questao--livre`.
8. Nenhum dado pessoal de professor (nome completo com CPF) vazou de material
   de origem. Os PDFs `*- FADESP - MATRIZ.pdf` são insumo interno e **nunca**
   são distribuídos.
