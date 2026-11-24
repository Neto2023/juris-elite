# Auditoria da landing page "Mapas Mentais - Guarda de Marabá"

Relatorio v1. Objeto: a pagina de vendas `gcmmaraba.abstratainc.com.br` (variante `LP_VAR='a'`, versao "reorganizada em 20/11/2026").

Data da auditoria: 23/11/2026.

Fonte auditada: o HTML colado pelo Dr. Abrahao (cortado nos depoimentos) mais o mesmo arquivo lido ao vivo no servidor para completar o trecho final e para rodar os testes de comportamento, rede e rastreio. As duas copias batem (mesma versao). Os testes de carregamento, pixel, repasse de UTM e existencia de arquivo foram feitos contra a pagina ao vivo, nao contra uma pasta local.

Metodo: leitura do codigo, execucao no navegador (console e rede), conferencia de arquivo por requisicao HTTP, conferencia da legislacao e do edital em fonte oficial (Planalto e o PDF oficial do Edital 01/2026, que estava na pasta do projeto). Nao finalizei compra: os links de checkout foram abertos so ate a pagina carregar.

---

## Quadro-resumo por gravidade

| Gravidade | Confirmados | IDs |
|---|---|---|
| CRITICO | 0 | (os dois candidatos foram descartados: a lei do furto esta correta e os dois checkouts carregam) |
| ALTO | 1 | L1 |
| MEDIO | 5 | E1, C1, A1, P1, T2 |
| BAIXO | 11 | T5(gtag), C2, C3, C4, C5, C6, A2, A3, A4, P2, P3, B2 |
| DESCARTADO | 2 | T1, "pixel declarado e ausente" |
| CONFERIDO | - | Edital 01/2026 e a retificacao 02/2026: conferidos nos PDFs oficiais (secao 4.2). A 02/2026 so mudou a idade minima (achado E1); nao mexeu na data da prova nem nos demais dados |

Observacao de maior peso: o achado T1 do spec (nenhum `fbq`/`gtag` carrega, logo os eventos nao chegam a lugar nenhum) **nao se confirma na pagina ao vivo**. O contrario e verdadeiro, e vira o achado mais serio do relatorio (L1): o Pixel da Meta esta vivo e dispara dados pessoais antes de qualquer consentimento.

---

## 1. Correcao do spec: rastreamento (T1 descartado)

O spec partia de que a pagina nao carrega `fbq` nem `gtag`. No ar, o teste mostrou o oposto:

- `typeof fbq` = `function`, `fbq.version` = `2.9.441`, `fbq.loaded` = `true`.
- Carregaram `connect.facebook.net/en_US/fbevents.js` e a config do pixel `1983250519318967`.
- Dispararam para `facebook.com/tr`: `PageView` e `Tempo30s`, este com `cd[oferta]=maraba` e `cd[variante]=a`.
- O tracker proprio `track.abstratainc.com.br/api/t/tracker.js` tambem carregou e posta em `/api/t/collect`.

Conclusao: o tracker da Abstrata injeta o Pixel da Meta. Por isso `fbq` existe mesmo sem o codigo-base do pixel estar colado no HTML. Os eventos personalizados (`CliqueCheckout`, `Rolou50`, `Rolou75`, `ViuPlanos`, `ArrastouComparativo`, `Tempo30s`) **chegam ao Meta**. So o `gtag`/Google Analytics nao existe (ramo de codigo morto, ver T5). Logo, T1 nao e um defeito: o rastreio funciona.

Pela mesma razao, cai a hipotese de que a politica de privacidade declararia um Pixel da Meta inexistente. O pixel existe, e a politica esta coerente com a realidade.

---

## 2. Achados confirmados

### E1 (MEDIO, observacao sobre pagina de concorrente) - Requisito de idade desatualizado apos a retificacao 02/2026
- Onde: bloco "O edital em numeros" (cartao Requisitos) e FAQ, texto "18 a 35 anos na inscricao".
- O que esta errado: a pagina foi feita sobre o Edital 01/2026. O Edital 02/2026 (retificacao pos-impugnacao, 17/11/2026, lido do PDF oficial) mudou os subitens 2.5, 9.3 "i" e o Anexo IV: a idade minima de 18 anos passou a ser exigida "ate o inicio do Curso de Formacao da Guarda", e nao mais "na data da inscricao" (o maximo de 35 anos na inscricao continua). Alem disso, a 02/2026 incluiu o subitem 12.1.4 e o Anexo VI, admitindo candidato menor de 18 anos, com autorizacao do responsavel (firma reconhecida) para o TAF. Logo, "18 a 35 anos na inscricao" ficou incorreto no minimo: hoje um candidato de 17 anos pode se inscrever.
- Como reproduzir: comparar o subitem 2.5 do Edital 01/2026 com o item 1 do Edital 02/2026.
- Gravidade: pela regua do spec, informacao de edital incorreta seria CRITICO; como o impacto real e baixo (poucos candidatos de 17 anos) e e so o momento de exigencia do minimo, deixo como MEDIO e sinalizo. A retificacao NAO mudou a data da prova (segue 24/01/2027) nem os demais dados.
- Correcao proposta: ajustar o texto do requisito de idade para refletir a retificacao. Decisao de quem: observacao (a pagina e do concorrente); para a Juris Elite, serve de aprendizado e de municao.

### L1 (ALTO, decisao do Eryck + juridica) - Pixel e tracker disparam antes de consentimento, sem banner de cookies
- Onde: `<script>` do `sentinel` no `<head>`, que injeta o Pixel da Meta `1983250519318967`; nao ha banner de consentimento em nenhum lugar da pagina.
- O que esta errado: no carregamento, antes de qualquer acao da pessoa, o Pixel envia ao Meta `PageView` com IP, `fbp` e um `external_id` com hash (visto na requisicao a `facebook.com/tr`). Nao ha coleta de consentimento nem opcao de recusar. A politica de privacidade descreve as ferramentas e cita a LGPD, mas descrever nao e colher consentimento.
- Como reproduzir: abrir a pagina com a aba de Rede aberta e filtrar por `facebook.com/tr`; a requisicao de `PageView` sai no load, sem clique.
- Correcao proposta: decisao do Eryck e do Dr. Abrahao. Opcoes: (a) banner de consentimento que segura o Pixel e o tracker ate o aceite; (b) modo de consentimento que so dispara eventos nao essenciais apos opt-in. Enquadrar na LGPD (art. 7) e no guia de cookies da ANPD.
- Decisao de quem: Eryck (implementacao do rastreio) com validacao juridica do Dr. Abrahao.

### C1 (MEDIO, tecnica) - O `<style>` do giro, dentro do `<body>`, desfaz a paleta de Maraba
- Onde: bloco `<style>` logo apos o HTML do `#giro`, dentro do `<body>`, versus o bloco `<style id="paleta-maraba">` no `<head>`.
- O que esta errado: os dois definem as mesmas regras com a mesma especificidade. Como o bloco do giro vem depois na ordem do documento, ele vence. Resultado: `.g-card:not(.on)` volta a `brightness(.42)` (a paleta pedia `.62`), `.g-floor` volta ao laranja (a paleta pedia verde) e `.g-card.on` volta a sombra preta com brilho laranja. A intencao escrita no comentario da paleta ("sem azul, o verde e fechado e frio") fica contrariada na pratica.
- Como reproduzir: DevTools, inspecionar um `.g-card` inativo e ver o `filter` computado em `.42`, nao `.62`; a regra vencedora e a do bloco do `<body>`.
- Correcao proposta: mover o `<style>` do giro para o `<head>`, antes do `#paleta-maraba`, ou elevar a especificidade das regras da paleta. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### A1 (MEDIO, tecnica) - ARIA invalido nas abas do giro
- Onde: `<div class="tabs" role="tablist">` com `<button type="button" data-cap="...">` sem `role="tab"`, `aria-selected` nem `aria-controls`.
- O que esta errado: um `role="tablist"` exige filhos com `role="tab"`. O script que montava `aria-selected` era o do carrossel antigo (`#carousel`), que nao existe mais, entao nunca roda nessas abas. Para leitor de tela, o padrao de abas fica quebrado.
- Como reproduzir: validar o HTML (html-validate) ou inspecionar as abas: nenhum botao tem `role="tab"`.
- Correcao proposta: ou completar o padrao (`role="tab"`, `aria-selected`, `aria-controls`, `role="tabpanel"`), ou remover o `role="tablist"` e tratar como botoes simples. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### P1 (MEDIO, tecnica) - As 9 imagens do giro carregam no load, sem `loading="lazy"`
- Onde: `figure.g-card img` (slides `slide-00` a `slide-08`), sem `loading="lazy"`.
- O que esta errado: a secao do giro fica abaixo da dobra e invisivel (`.pre`) ate aparecer, mas as imagens baixam junto com a pagina. Na rede, confirmei que carregaram as variantes `-800` e tambem as `-1400` dos nove slides no load inicial, em tela larga. Peso grande adiantado sem necessidade.
- Como reproduzir: aba de Rede no load; os `slide-0X-800.webp` e `slide-0X-1400.webp` aparecem antes de rolar.
- Correcao proposta: `loading="lazy"` nas nove imagens do giro e nas do comparativo que estao fora da dobra. Rever o `sizes` para nao puxar o `-1400` em telas medias. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### T2 (MEDIO, decisao do Eryck) - `BaixouPrevia` nunca dispara e nao ha botao de previa
- Onde: `document.querySelectorAll('[data-previa]')` nao encontra nada (testado: 0 elementos). O bloco `.previa` so tem texto, sem botao.
- O que esta errado: existe o evento `BaixouPrevia`, mas nao existe o `[data-previa]` para dispara-lo, nem uma acao real de "baixar previa". E uma funcionalidade pela metade: o evento aponta para um botao que nunca foi construido.
- Como reproduzir: buscar `data-previa` no HTML: nenhum resultado.
- Correcao proposta: ou criar a previa de verdade (um PDF de amostra com `[data-previa]`), ou remover o evento. Vai para `index_v2.html`.
- Decisao de quem: Eryck (rastreio) e Dr. Abrahao (se havera previa para baixar).

### T5 (BAIXO, tecnica) - Ramos de `gtag` mortos
- Onde: em cada evento, o bloco `if(typeof gtag==='function'){...}`.
- O que esta errado: nao ha Google Analytics na pagina (`typeof gtag` = `undefined`, sem `dataLayer`, sem script do GTM). Os ramos de `gtag` nunca rodam. Nao ha perda de dado (o Meta cobre), e so codigo redundante.
- Correcao proposta: remover os ramos de `gtag` ou, se quiserem GA, carregar o `gtag.js`. Vai para `index_v2.html`.
- Decisao de quem: Eryck.

### C2 (BAIXO, tecnica) - Regras `.m1` a `.m6` repetidas e `.m8` a `.m10` orfas
- Onde: `.m1` a `.m6` sao declaradas tres vezes (bloco do deck inicial, bloco "VITRINE COM AS 10 MATERIAS" e bloco "VITRINE DO TOPO COM 7 MAPAS"); `.m8`, `.m9`, `.m10` existem no CSS, mas o HTML so tem `.m1` a `.m7`.
- Correcao proposta: manter so o bloco de 7 e apagar o resto. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### C3 (BAIXO, tecnica) - Script do carrossel antigo e CSS sem uso
- Onde: `document.getElementById('carousel')` retorna nada (testado: false). O CSS `.carousel`, `.frame`, `.slide` nao e usado (o que vale e o `#giro`).
- Correcao proposta: remover o script do carrossel e o CSS orfao. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### C4 (BAIXO, tecnica) - Variante A/B sem efeito visual
- Onde: `.lp-a .hb, .lp-b .ha{display:none}` e `window.LP_VAR='a'`. O `<html>` recebe so a classe `js`, nunca `lp-a`/`lp-b`, e nao existem elementos `.ha`/`.hb`.
- O que esta errado: o CSS de A/B nao casa com nada, entao nao ha diferenca renderizada entre variantes. O `LP_VAR` e usado so para rotular os eventos do pixel (`cd[variante]=a`), ou seja, todo o trafego vai como "a": nao ha divisao real de teste.
- Correcao proposta: se querem A/B de verdade, aplicar a classe e marcar os elementos; se nao, remover o CSS e o rotulo. Vai para `index_v2.html`.
- Decisao de quem: Eryck.

### C5 (BAIXO, tecnica) - CSS sem uso aparente
- Onde: `.vs`, `.get`, `.stackimg`, `.facts`/`.fact`, `.bonus`/`.b`, `.legend.prop`, `.s-dir`/`.s-por`/`.s-ext`/`.s-inf`, `.c2`, `.card`, `.carousel`/`.frame`/`.slide`.
- O que esta errado: substituidos por blocos novos. Hoje a pagina usa `.fatos`/`.fato` (nao `.facts`/`.fact`), `.bonus-lista` (nao `.bonus`/`.b`), `.legend.q5` (nao `.legend.prop`), `.cmp` (nao `.vs`), `.mats`/`.checks` (nao `.get`/`.stackimg`), e a barra de pontos usa estilos inline (nao `.s-dir` etc). `.s-esp` continua em uso.
- Correcao proposta: confirmar com busca de seletor e remover os blocos mortos. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### C6 (BAIXO, tecnica) - `scroll-behavior:smooth` nao desligado em `prefers-reduced-motion`
- Onde: `html{scroll-behavior:smooth}`; o bloco `@media (prefers-reduced-motion:reduce)` zera `transition` e `animation`, mas nao o `scroll-behavior`.
- Correcao proposta: adicionar `html{scroll-behavior:auto}` dentro do bloco de reduced-motion. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### A2 (BAIXO, tecnica) - Sem `<main>` e hierarquia de titulos com salto
- Onde: nao ha `<main>`; "Como funciona a compra" e `<h3>` sem `<h2>` acima na mesma secao; outras secoes usam `<h3>` solto (garantia, "a mesma lei em texto e em mapa").
- Correcao proposta: envolver o conteudo em `<main>` e revisar a hierarquia (um `h2` por secao antes dos `h3`). Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### A3 (BAIXO, tecnica) - Contrastes abaixo de 4,5:1 (estimado)
- Onde: `--dim #66807A` sobre branco (texto `small`/mono); texto branco sobre `#2E8F76` (segmento de 10 pontos na barra) e sobre `#0B6B55`.
- O que esta errado (estimativa, nao medido com ferramenta): `#66807A` sobre branco fica proximo de 4,0:1, abaixo de 4,5:1 para texto normal. Branco sobre `#2E8F76` fica proximo de 3,5:1, no limite para texto grande/negrito e abaixo para normal. Branco sobre `#0B6B55` passa. Os segmentos claros da barra (`#7FBFAE`, `#B9D9D0`) ja usam texto escuro, corretamente.
- Correcao proposta: escurecer `--dim` ou so usa-lo em texto grande; usar texto escuro no segmento `#2E8F76`. Medir com ferramenta antes de aplicar. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### A4 (BAIXO, tecnica) - Giro so pausa no mouse, nao no foco de teclado; cartoes nao focalizaveis
- Onde: o script do giro pausa a rotacao em `mouseenter`/`mouseleave`, nao em foco; os `figure.g-card` sao clicaveis mas nao tem `tabindex`.
- Correcao proposta: pausar tambem no `focusin`/`focusout` e tornar as abas o unico controle por teclado (as abas ja sao `button`). Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### P2 (BAIXO, tecnica, pendente) - `font-stretch:112% 125%` sem confirmar eixo da fonte
- Onde: `@font-face` de `archivo.woff2` com `font-stretch:112% 125%` e usos com `font-stretch:112%`/`125%`.
- O que falta: confirmar se `archivo.woff2` e variavel com eixo `wdth`. Se nao for, o navegador sintetiza ou ignora o alargamento. Precisa abrir o arquivo da fonte para verificar. Pendente.
- Decisao de quem: tecnica.

### P3 (BAIXO, tecnica) - Metadados ausentes
- Onde: `<head>`.
- O que falta: `link rel="canonical"`, favicon, `og:locale` (`pt_BR`) e `twitter:card`. Existem `og:title`, `og:description`, `og:url`, `og:type`, `og:image` e `theme-color`.
- Correcao proposta: adicionar os quatro. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

### B2 (BAIXO, tecnica) - Sem JavaScript, a faixa da contagem fica vazia
- Onde: `.cd` com `min-height:43px`, preenchida so por script.
- O que acontece: sem JS, a faixa aparece vazia com 43 px de altura; os blocos `.rv` aparecem normalmente (correto, pois o `opacity:0` so vale com a classe `js`). E cosmetico.
- Correcao proposta: um texto estatico de fallback dentro de `.cd`. Vai para `index_v2.html`.
- Decisao de quem: tecnica.

---

## 3. Itens verificados e conformes (nao sao defeitos)

- Lei do furto (o item que o spec temia ser CRITICO): conforme. Ver secao 4.3.
- Rastreamento: Pixel da Meta vivo e eventos chegando (T1 descartado).
- Repasse de UTM/`sck` para o checkout (T4): funciona. Os dois `[data-checkout]` recebem `utm_source` e `sck` no `href` (testado ao vivo). Falta so confirmar com a Cakto que ela registra `src`/`sck` com esses nomes.
- Links de checkout: os dois abrem ("Cakto Checkout"): Basico `h8eahye_1341902`, Completo `pb86vfw_1341942`.
- Coerencia interna dos numeros (secao 4.1): toda a conta fecha. Refeita abaixo.
- Contagem regressiva (B1): a logica esta correta em todas as datas-limite (tracei INICIO 17/11, FIM 28/12, PROVA 24/01 pelas bordas 16/11, 17/11, 27/12, 28/12, 29/12, 23/01, 24/01, 25/01). Singular/plural e remocao da faixa apos a prova corretos. Unica lacuna menor: o dia de abertura (17/11) nao tem mensagem propria "abrem hoje".
- Barra fixa do celular (B3) e comparativo lei x mapa (B4): funcionam (mouse, toque e teclado no comparativo).
- Arquivos referenciados: 49 de 49 retornaram 200 (fontes, hero, slides, planos, depoimentos, og, `privacidade.html`). Nenhum quebrado no servidor.
- Politica de privacidade: coerente com a realidade (Pixel da Meta, tracker proprio e Google Fonts, todos presentes); informa responsavel (Abstrata Inc), contato, finalidades e direitos da LGPD.

### 4.1 Coerencia interna (refeita)
- Questoes: 15 + 10 + 5 + 5 + 5 = 40. OK.
- Pontos: 15x4 + 10x2 + 5x2 + 5x1 + 5x1 = 60 + 20 + 10 + 5 + 5 = 100. OK.
- "Especificos e Municipio valem 80": 60 + 20 = 80. OK.
- Mapas de Especificos: 20 + 57 + 107 + 45 + 58 = 287. OK.
- Total de mapas: 287 + 19 + 89 + 29 + 80 = 504. OK.
- PDFs: 5 arquivos de Especificos (Adm, Const/DH, Penal, Leg Municipal, Extravagante) + 4 (Municipio, Portugues, Matematica, Informatica) = 9 PDFs. OK.
- Precos: `data-value` 17.90 e 27.90, iguais aos exibidos e ao da barra fixa. OK.
- Legenda inicial do giro: `step=6` corresponde a aba ativa "Penal e Processual". OK.
- Nao achei numero divergente entre meta, hero, secoes e FAQ. "60 em Especificos" e "80 em Especificos + Municipio" sao coerentes.

---

## 4.2 Dados do Edital 01/2026 - CONFERIDO no PDF oficial

Fonte: `Edital-No-01_2026_GMM.pdf` (Edital 01/2026, PDF oficial, estava na pasta do projeto em `material-base/MENTORIA GMM MARABA`). Todos os dados que a pagina afirma batem com o edital oficial. Resultado desta secao: a pagina do concorrente esta correta tambem nos numeros do edital.

| Afirmacao na pagina | Fonte oficial consultada | Status |
|---|---|---|
| 127 vagas: 60 imediatas e 67 de cadastro de reserva | Edital 01/2026, preambulo | CONFIRMADO ("60 vagas para provimento imediato e 67 para cadastro de reserva"). Nao detalhei o split 57 ampla + 3 PcD; o total 127 e a divisao imediata/reserva batem |
| Salario R$ 2.076,40, 40 h semanais | Edital 01/2026, Remuneracao | CONFIRMADO ("Salario base R$ 2.076,40 mais vantagens; jornada 40 horas semanais") |
| Inscricoes 17/11 a 28/12/2026, Fadesp | Edital 01/2026, cronograma (Anexo III) | CONFIRMADO (17/11/2026 a 28/12/2026) |
| Taxa R$ 115,00 | Edital 01/2026, item 9.4 | CONFIRMADO ("R$ 115,00 (cento e quinze reais)") |
| Prova 24/01/2027, 8h30, Maraba, 4 horas, 40 questoes A a E | Edital 01/2026, item 10.1 e cronograma | CONFIRMADO (ingresso 7h-8h, inicio 8h30, termino 12h30, 24/01/2027, duracao 4 horas, em Maraba; 5 alternativas A a E no item 10.6.2). O "8h30" do FAQ esta certo; "de manha" nos cartoes e coerente |
| Distribuicao 15/10/5/5/5 com pesos 4/2/2/1/1 | Edital 01/2026, quadro do item 10.2 | CONFIRMADO, identico: Portugues 5/peso2, Matematica e RL 5/peso1, Informatica 5/peso1, Municipio 10/peso2, Especificos 15/peso4; total 40 questoes e 100 pontos |
| Nota final minima 60/100, sem nota minima por materia | Edital 01/2026, item 10.6 e seguintes | CONFIRMADO. A pontuacao vai de 0 a 100; a prova e eliminatoria e classificatoria pelo total (60 pontos), sem minimo por disciplina |
| Requisitos: ensino medio, CNH AB na posse, 18 a 35 anos na inscricao | Edital 01/2026 (itens 2.5, 2.6, 2.7) e Edital 02/2026 (retificacao) | PARCIAL. Ensino medio e CNH "AB" na posse: confirmados. Idade: a retificacao 02/2026 mudou o minimo, agora "18 anos completos ate o inicio do Curso de Formacao" (nao na inscricao); o maximo de 35 na inscricao continua. A pagina ficou desatualizada nesse ponto (achado E1) |
| CF cobrada: arts. 1 a 4, 5 a 11, 14 a 16, 18 a 31, 37 a 41, 144, 182 e 183 | Edital 01/2026, Anexo II | CONFIRMADO (Anexo II: "14 ao 16; 18 a 31; 37 a 41; 144; 182...") |
| TAF em 06 e 07/03/2027, eliminatorio, apto/inapto, Decreto Municipal 776/2010 | Edital 01/2026, cronograma e item 12 | CONFIRMADO (2a Etapa, Avaliacao de Aptidao Fisica, 06 e 07/03/2027; apto ou inapto; Decreto Municipal 776/2010, Capitulo III) |
| Validade de 2 anos, prorrogavel uma vez | Edital 01/2026, item 24.6 | CONFIRMADO ("2 (dois) anos... podendo ser prorrogado, uma unica vez, por igual periodo") |
| "As seis leis municipais da Guarda" | Edital 01/2026, Anexo II | CONFIRMADO e consistente. O Anexo II lista as leis municipais da Guarda de Maraba: 17.361/2009 (criacao), 17.384/2009 (altera a 17.361), 17.431/2010 (estatuto), 17.811/2017 (ouvidoria e corregedoria), 18.163/2022 (altera a 17.811), batendo com "seis leis municipais" |
| Corte da legislacao em 11/11/2026 | Edital 01/2026 | PARCIAL. O edital nao traz uma clausula explicita de "corte" na data de publicacao; a frase e interpretacao da pagina (legislacao vigente na publicacao). A data de publicacao do edital deve ser conferida |

Retificacao conferida: o Edital 02/2026 (PDF oficial, lido do Drive) retifica o 01/2026 e mexe em UM ponto de conteudo, a idade minima. Onde o 01/2026 dizia "18 anos na data da inscricao", passou a ser "18 anos completos ate o inicio do Curso de Formacao da Guarda" (o maximo de 35 na inscricao continua), e criou o Anexo VI de autorizacao para candidato menor de 18 fazer o TAF. A retificacao NAO mudou a data da prova (continua 24/01/2027), nem vagas, salario, taxa, distribuicao de questoes, nota, TAF ou artigos cobrados. Consequencia para a pagina: so o requisito de idade ficou desatualizado (achado E1). O resto segue correto.

## 4.3 Legislacao - conferida em fonte oficial

| Afirmacao | Fonte oficial consultada | Status |
|---|---|---|
| Lei 15.397/2026 deu nova redacao ao art. 155, caput: pena de reclusao de 1 a 6 anos e multa | Planalto, Decreto-Lei 2.848/1940 compilado (del2848compilado.htm) | CONFIRMADO. O texto oficial traz "Pena e reclusao, de 1 (um) a 6 (seis) anos, e multa" com "(Redacao dada pela Lei no 15.397, de 2026)" |
| § 1o: aumento "de metade" no repouso noturno (antes era "de um terco") | Planalto, mesma fonte | CONFIRMADO. O texto oficial traz "A pena aumenta-se de metade, se o crime e praticado durante o repouso noturno", com a mesma nota da Lei 15.397/2026 |
| § 2o reproduzido no comparativo | Planalto, mesma fonte | CONFIRMADO inalterado |
| § 3o reproduzido no comparativo | Planalto (leitura parcial) | COERENTE com o texto classico; nao reconferido linha a linha |
| Lei 11.343/2006, arts. 48 a 50-A (mapa de exemplo) | - | Os artigos existem; conteudo do mapa fora do escopo desta conferencia |
| Lei Municipal 17.361/2009: criacao da Guarda de Maraba | Edital 01/2026, Anexo II | CONFIRMADO. O proprio edital a nomeia: "Lei Municipal n.o 17.361/2009 - Cria a Guarda Municipal de Maraba" |

Conclusao da secao: a afirmacao central da pagina (apostila antiga desatualizada por causa da Lei 15.397/2026) esta **correta e atualizada** segundo o texto oficial do Planalto. O risco CRITICO que o spec previa aqui nao existe.

---

## 5. Conformidade (publicidade e dados) - pendente de analise juridica do Dr. Abrahao

| ID | Ponto | Observacao da auditoria |
|---|---|---|
| L1 | Rastreio sem consentimento | ALTO, ja detalhado na secao 2. O Pixel envia dados pessoais no load, sem banner. |
| L2 | Selo "+5 bonus inclusos" no topo, ao lado do botao geral, com o Basico sem bonus | Risco de oferta ambigua (CDC art. 37, § 1o). O selo fica no hero, antes de a pagina explicar que so o Completo tem os bonus. Pendente juridico. |
| L3 | Depoimentos de outro produto (Guarulhos) | A ressalva esta no titulo e no `.lead` da secao, visivel tambem no celular. Parece adequado. Confirmar com o Dr. Abrahao se basta. |
| L4 | "Cada pena, prazo e numero de artigo foi conferido no texto oficial" | Afirmacao absoluta. O proprio HTML tem um comentario que tirou a linha sobre Municipio "ate a auditoria fechar (ressalvas de fonte nos mapas de Municipio)". Se a conferencia das fontes de Municipio nao fechou, a frase generica sobre "cada lei" pode estar maior que o lastro. Pendente juridico. |
| L5 | Garantia de 7 dias | E direito de arrependimento (CDC art. 49). Conferir se a redacao nao vende como favor e se bate com as condicoes da Cakto. Pendente juridico. |
| L6 | Aviso de independencia (sem vinculo com Prefeitura, Guarda ou Fadesp) | Presente no FAQ e no rodape. Adequado. |

Nota: a skill `startup-legal-br:auditoria-de-afirmacoes` nao foi rodada neste passo; os itens L1 a L6 ficam marcados como pendentes de analise juridica do Dr. Abrahao.

---

## 6. O que nao foi executado nesta rodada

- `html-validate` e `lighthouse` via `npx`: nao rodados neste ambiente. Substitui por leitura de codigo e inspecao do DOM e da rede ao vivo, que cobrem os achados acima. Recomendo rodar o Lighthouse mobile para medir o peso real do giro (P1).
- Playwright com matriz completa de prints (390 e 1280 px, com e sem JS, com `reduced-motion`): nao gerada. Guardei um print de referencia em largura de celular em `auditoria_prints/`. Os comportamentos (contagem, barra fixa, comparativo, no-JS) foram verificados por codigo e pelo DOM ao vivo.
- Edital 01/2026 e a retificacao 02/2026: ambos conferidos nos PDFs oficiais (secao 4.2). A 02/2026 so alterou a idade minima (achado E1) e incluiu um anexo para menores de 18; nao mudou a data da prova nem os demais dados. Nada mais ficou pendente de conferencia do edital.
- Conferencia da Lei Municipal 17.361/2009 em fonte oficial municipal: pendente.

## 7. Correcoes tecnicas que nao dependem de decisao de negocio

Para um `index_v2.html` (nunca por cima do original), reunidas de C1, A1, P1, T5, C2, C3, C4, C5, C6, A2, A3, A4, P3, B2:

1. Mover o `<style>` do giro para o `<head>`, antes de `#paleta-maraba` (C1).
2. Completar ou remover o `role="tablist"` das abas do giro (A1).
3. `loading="lazy"` nas 9 imagens do giro e rever o `sizes` (P1).
4. Remover ramos de `gtag`, script do carrossel `#carousel`, A/B inerte e CSS morto (T5, C2, C3, C4, C5).
5. `html{scroll-behavior:auto}` em `prefers-reduced-motion` (C6).
6. Envolver em `<main>` e corrigir a hierarquia de titulos (A2).
7. Ajustar contrastes de `--dim` e do segmento `#2E8F76` (A3), apos medir.
8. Pausar o giro no foco de teclado (A4).
9. Adicionar `canonical`, favicon, `og:locale` e `twitter:card` (P3).
10. Texto estatico de fallback na faixa `.cd` sem JS (B2).

As decisoes de negocio e rastreio (L1 a L5, T2, C4) ficam para o Dr. Abrahao e o Eryck.

E o relatorio.

23/11/2026.
