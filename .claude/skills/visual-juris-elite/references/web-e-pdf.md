# Peças em HTML e PDF

Vale para landing page, Mapa de Pontos, criativo de anúncio, capa, resumo,
cronograma e todo PDF que **nós** renderizamos (controlamos a fonte e a cor).

## Esqueleto

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Nome curto da peça</title>
<link rel="icon" href="marca/juris-elite-icone-32.png">
<link rel="stylesheet" href="sistema/fontes.css">
<link rel="stylesheet" href="sistema/tokens.css">
<link rel="stylesheet" href="sistema/componentes.css">
</head>
<body class="je">
...
</body>
</html>
```

Peça de arquivo único (anexo de WhatsApp, artefato publicado): cole o conteúdo
de `tokens.css` e `componentes.css` dentro de um `<style>` em vez de referenciar,
e embuta a marca como `data:` URI ou mantenha o PNG ao lado.

## Componentes prontos

**Cabeçalho de peça**

```html
<header class="je-cabecalho">
  <img class="je-marca" src="marca/juris-elite-horizontal.png" alt="Juris Elite">
  <p class="je-rotulo">Mentoria GMM Marabá · Edital 01/2026</p>
</header>
```

**Alerta de pegadinha**

```html
<aside class="je-alerta">
  <p class="je-alerta__titulo">Atenção — alerta de pegadinha FADESP</p>
  <p>A banca troca "competência" por "atribuição" e conta como erro. ...</p>
</aside>
```

**Mnemônico**

```html
<aside class="je-mnemonico">
  <span class="je-mnemonico__sigla">DCI-JL-CP</span>
  <p>Dignidade · Cidadania · Igualdade · Justiça · Legalidade · Capacitação · Participação</p>
</aside>
```

**Tabela de incidência**

```html
<table class="je-tabela">
  <caption>Incidência por subitem — Direito Constitucional</caption>
  <thead><tr><th>Subitem</th><th class="num">Questões</th><th class="num">Incidência</th></tr></thead>
  <tbody>
    <tr><td>Direitos e garantias fundamentais</td><td class="num">6</td><td class="num">40%</td></tr>
  </tbody>
  <tfoot><tr><td>Total</td><td class="num">15</td><td class="num">100%</td></tr></tfoot>
</table>
```

**Dado em destaque com barra de peso**

```html
<div>
  <span class="je-numero">60<span class="je-numero__rotulo je-rotulo">dos 100 pontos são Direito</span></span>
  <span class="je-barra"><span class="je-barra__preenche" style="width:60%"></span></span>
</div>
```

A barra é `display:block` por dentro — `span` em linha ignora largura e altura.
Esse bug já custou uma rodada; o componente já vem corrigido.

**Rodapé**

```html
<footer class="je-rodape">
  <span>Juris Elite · Mentoria GMM Marabá · Prof. Walter Ruiz e Prof. Diego Souza</span>
  <span>Edital 01/2026-GMM</span>
</footer>
```

## Gerar o PDF

```bash
python identidade/sistema/gerar-pdf.py material/pasta-da-peca/peca.html
```

E o Word, a partir do mesmo HTML, para o aluno que quer editar:

```bash
python identidade/sistema/gerar-docx.py material/pasta-da-peca/peca.html material/pasta-da-peca/Nome-Entregue.docx
```

O `.docx` lê a capa e a assinatura do próprio HTML, de modo que os dois
formatos não têm como divergir. Ele percorre a árvore por tag e classe:
questão é `div.questao` com `p.cab`, alerta e mnemônico são `div`, e o título
de caixa é `p.t` ou `div.t`. Peça que use `article` e `aside` passa batido.

Use sempre esse script, e não o Chrome direto no arquivo. Ele sobe um servidor
local na raiz do projeto, imprime pelo `http://127.0.0.1` e, ao final, confere
quais famílias ficaram embutidas no PDF.

**Por que o `file://` não serve.** O Chrome trata `file://` como origem opaca e
recusa, por CORS, o download de fontes declaradas em `@font-face`. O PDF sai
silenciosamente tipografado na fonte de sistema: sem Playfair, sem Source Serif,
sem Inter. Nada avisa. Foi assim que a primeira versão do Dossiê Marabá saiu
inteira em Cambria.

**Nada de `<link>` do Google Fonts na peça.** `identidade/sistema/fontes.css` já
traz as faces da marca **embutidas em base64**, e é a única fonte de verdade.
O link remoto do Google declara as mesmas famílias depois dele na cascata,
aponta para arquivos que o headless pode não baixar a tempo, e o resultado é um
PDF com Cambria ou Segoe UI no lugar da fonte certa, de forma **intermitente**:
a mesma peça sai certa numa execução e errada na seguinte.

**Por que as fontes estão em base64 e não como arquivo ao lado.** Com arquivo
externo, o Chrome descobre a face só quando o layout encontra o caractere, e às
vezes imprime antes de ela chegar. Embutida, a face existe assim que o CSS é
lido. Os `.woff2` originais continuam em `identidade/sistema/fontes/` e são a
origem do arquivo: para acrescentar peso ou subconjunto, baixe o `.woff2` e gere
o CSS de novo a partir dele.

**Caractere fora do subconjunto.** O `fontes.css` cobre `latin`, `latin-ext` e,
para Inter e Source Serif 4, `greek` (o π e o Δ das fórmulas). Glifo fora disso
(seta `→`, sinal `≠`, radical `√`) cai em fonte de sistema e aparece no aviso do
script. Troque por chevron `›`, por palavra ("raiz de") ou por caractere ASCII.

**A Playfair não tem grego.** Fórmula com π ou Δ não vai em `--je-display`:
`.formula .exp` usa `--je-leitura` no peso 600, que é a face que o corpo do
texto já carrega. Face que não é usada em nenhum outro lugar da página não é
buscada pelo Chrome só para servir de fallback.

**Elemento que estoura a largura encolhe o PDF inteiro.** Quando algo é mais
largo que a folha, o Chrome não corta nem deixa transbordar: ele reduz a escala
da peça toda até caber. O PDF sai inteiro, legível, com as fontes certas, e
com o tipo menor e menos páginas. Nada avisa, nem na tela nem no gerador. O
suspeito de sempre é a pílula `.et`, que tem `white-space: nowrap` porque
rótulo curto não deve quebrar; uma frase de cem caracteres dentro dela passa
dos 800px e derruba a escala. Frase vai em linha (`.questao .edital`), não em
pílula. Para conferir, abra a peça com 794px de largura e rode:

```js
[...document.querySelectorAll('.folha *')]
  .filter(n => n.scrollWidth > document.querySelector('.folha').clientWidth)
```

Tem de voltar vazio. O sintoma indireto é paginação díspar: três cadernos de
mesmo volume saíram com 50, 71 e 82 páginas, e a diferença não era conteúdo.

**Bloco indivisível alto demais deixa meia folha em branco.** `break-inside:
avoid` serve a cartão, alerta e tabela. Não serve a uma questão comentada
inteira, que passa de meia folha: o Chrome empurra o bloco todo para a folha
seguinte, deixa o vão atrás e estoura a folha do mesmo jeito. Para esses casos
existe `.questao--livre`, que deixa a questão partir e mantém indivisíveis
apenas as caixas de dentro.

Três coisas quebram o PDF, nessa ordem de frequência:

1. **Falta o doctype.** Sem `<!doctype html>` o Chrome renderiza em quirks mode
   e a página sai torta. Artefato publicado não traz doctype: ao gerar PDF de um
   artefato, embrulhe o arquivo com `<!doctype html><html lang="pt-BR">` antes.
2. **Fundo colorido some.** Sem `print-color-adjust: exact` o navegador descarta
   cor de fundo na impressão. Já está em `tokens.css`, dentro de `@media print`.
3. **Bloco partido ao meio.** Use `break-inside: avoid` em cartão, tabela e
   caixa, e `break-before: page` no que precisa abrir folha.

Bloco de impressão mínimo da peça:

```css
@media print{
  @page{ size: A4; margin: 18mm 16mm }
  .je-cartao, .je-alerta, .je-mnemonico, .je-tabela, .je-questao{
    break-inside: avoid; page-break-inside: avoid;
  }
  .je-capa{ break-after: page; page-break-after: always }
}
```

Depois de gerar, **confira a paginação** (número de páginas e primeira linha de
cada uma) antes de entregar. Peça que estoura a folha com o rodapé dizendo
"página 1 de 2" já foi entregue uma vez; não repita.

## Material antigo, sem identidade

Os `.docx` originais da Mentoria ficam em `material-base/` e são a origem. Não
se edita a identidade dentro deles: converte-se para HTML da casa, e dali saem
o PDF e o Word novos.

```bash
python identidade/sistema/converter-legado.py tudo
```

O conversor preserva o texto ao pé da letra. Não reescreve enunciado,
alternativa, gabarito, comentário nem transcrição de lei: apenas remapeia a
estrutura para os dispositivos do `impresso.css` e troca a pontuação de
travessão, que a casa não usa. Ele monta o quadro-resumo do gabarito a partir
das próprias questões (quatro dos seis cadernos antigos não tinham um) e, nos
dois que já traziam a tabela, confere uma contra a outra.

Depois de converter, confira contagem de palavras entre o `.docx` de origem e o
HTML gerado. Rótulo some de propósito (o cabeçalho "QUESTÃO 01 (Inédita ...)"
vira a etiqueta da casa), conteúdo não some nunca. Diferença de ordem é normal
onde o dispositivo reordena, como a sigla do mnemônico, que sai do fim do
título e vira a etiqueta da caixa.

## Criativo de anúncio

Formato 1080×1350 (feed) e 1080×1920 (stories). Fundo marinho, marca negativa no
topo, uma afirmação em Playfair de no máximo 9 palavras, um número grande em
âmbar, e o CTA. Âmbar aparece **aqui** — é a peça para a qual ele existe.
Nada de texto ocupando mais de 20% da área.
