# Paleta e tipografia — valores canônicos

Os valores abaixo são a fonte de verdade. O logotipo entregue pela casa foi
recolorido para bater exatamente com eles, então marca e fundo nunca destoam.

## Paleta

| Papel | Token | Hex | Onde usa |
|---|---|---|---|
| Cor-mãe | `--je-marinho` | `#10283F` | fundo institucional, título, cabeçalho de tabela, botão primário |
| Marinho escuro | `--je-marinho-escuro` | `#0A1A2A` | capa, rodapé, modo escuro |
| Marinho claro | `--je-marinho-claro` | `#1B3F61` | cartão sobre marinho, borda interna |
| Assinatura | `--je-ouro` | `#B89A63` | filete, monograma, selo, borda. **Nunca texto em fundo claro** |
| Ouro claro | `--je-ouro-claro` | `#D4BC8E` | filete e rótulo **sobre marinho** |
| Ouro de texto | `--je-ouro-texto` | `#7B6338` | o único ouro válido para texto em fundo claro |
| Ação | `--je-ambar` | `#E4A139` | CTA, anúncio, contagem regressiva. Nada além disso |
| Papel | `--je-creme` | `#F4F0E8` | fundo de peça |
| Folha | `--je-creme-fundo` | `#FBF9F5` | leitura longa |
| Divisória | `--je-creme-borda` | `#E3DCCD` | linha em fundo claro |
| Texto | `--je-grafite` | `#24282C` | corpo |
| Apoio | `--je-grafite-suave` | `#55606B` | legenda, metadado |
| Pegadinha | `--je-alerta` | `#C0392B` | filete do alerta de banca |
| Gabarito | `--je-acerto` | `#1E7A54` | filete da resposta comentada |

## Contraste medido (WCAG 2.1)

Checado, não estimado:

| Combinação | Razão | Veredito |
|---|---|---|
| `#F4F0E8` sobre `#10283F` | 13,22:1 | AAA |
| `#10283F` sobre `#F4F0E8` | 13,22:1 | AAA |
| `#24282C` sobre `#F4F0E8` | 13,06:1 | AAA |
| `#E4A139` sobre `#10283F` | 6,77:1 | AA |
| `#B89A63` sobre `#10283F` | 5,61:1 | AA |
| `#7B6338` sobre `#F4F0E8` | 5,02:1 | AA |
| **`#B89A63` sobre `#F4F0E8`** | **2,36:1** | **reprova — proibido para texto** |

A armadilha desta paleta é uma só: ouro sobre creme. É bonito e é ilegível.
Ouro sobre claro só como forma (filete, borda, ícone cheio), nunca como letra.

## Tipografia

| Papel | Família | Uso |
|---|---|---|
| Display | **Playfair Display** 700 | título, capa, numeral em destaque, sigla de mnemônico. Parentesco direto com o logotipo |
| Leitura | **Source Serif 4** 400/600 | corpo de caderno, e-book, apostila, citação |
| Interface | **Inter** 400/600/700 | rótulo, tabela, legenda, botão, web, metadado |

Carregamento em HTML:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Escala

`12 · 14 · 16 · 18 · 22 · 28 · 36 · 48` px (razão ≈ 1,25). Nada fora dela.

### Regras que não se negociam

- Rótulo de seção: Inter, 12 px, 600, versal, entreletra `0.12em`, cor
  `--je-ouro-texto` em fundo claro ou `--je-ouro-claro` em marinho.
- Texto corrido em versal: nunca. Versal só em rótulo de até ~5 palavras.
- Medida de leitura: no máximo `68ch`. Em A4, isso é a coluna única com
  margem de 20 mm.
- Entrelinha: 1,5 em tela, 1,65 em impresso.
- Numeral de tabela e de dado: `font-variant-numeric: tabular-nums`.
- Itálico: só em `.je-capa__linha` e em nome de obra. Não é ênfase.
- Negrito: ênfase. No máximo uma expressão por parágrafo.

## Arquivos de marca

Em `identidade/marca/` (na raiz do projeto):

| Arquivo | Para |
|---|---|
| `juris-elite-horizontal.png` | fundo claro (creme, branco) |
| `juris-elite-horizontal-negativo.png` | fundo marinho |
| `juris-elite-horizontal-mono-marinho.png` | uma cor, fundo claro |
| `juris-elite-horizontal-mono-claro.png` | uma cor, fundo escuro |
| `juris-elite-monograma.png` | selo, carimbo, marca d'água, espaço apertado |
| `juris-elite-monograma-negativo.png` | selo sobre marinho |
| `juris-elite-icone-512.png` | avatar, perfil, app |
| `juris-elite-icone-180.png` / `-64` / `-32` | favicon e touch icon |

Todos têm fundo transparente. Não aplique sombra, contorno, gradiente nem
rotação. Não altere a proporção. Não troque as cores do arquivo.
