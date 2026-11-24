# Plano de implementacao das LPs da Juris Elite

A partir da auditoria do concorrente (`AUDITORIA_LP_MARABA_relatorio_v1.md`, 23/11/2026).

## Para que serve este plano

A auditoria olhou a pagina de vendas do concorrente (Abstrata Inc, "Mapas Mentais - Guarda de Maraba", `gcmmaraba.abstratainc.com.br`). O modelo dele e diferente do nosso: **ele vende PDFs de mapas direto na Cakto (R$ 17,90 e R$ 27,90); a Juris Elite entrega o Mapa de Pontos de graca e usa isso como isca para o WhatsApp, onde o atendente vende a mentoria (R$ 99,99).** Entao este plano nao copia o produto dele. Ele pega as licoes da auditoria e aplica nas nossas paginas: `automacao/landing/index.html` (casa), `automacao/landing/guarda-maraba.html` (campanha) e `automacao/landing/mapa-de-pontos.html` (material impresso).

O que ja foi feito nesta rodada: as fotos dos dois socios (Dr. Walter Ruiz e Dr. Diego Souza) entraram nas secoes "Quem ensina" das duas paginas da web.

## Quadro de prioridades

| # | Acao | Dono | Esforco | Achado de origem |
|---|---|---|---|---|
| 1 | Travar o Pixel ate o consentimento + banner de cookies | Dev + socios (juridico) | Medio | L1 |
| 2 | Criar `privacidade.html` e linkar no rodape e no formulario | Dev + socios (juridico) | Medio | L1, seccao 3 |
| 3 | Aviso de independencia (sem vinculo com Prefeitura/Guarda/Fadesp) | Dev + socios | Baixo | L6 |
| 4 | Revisar oferta e promessas (CDC): nada absoluto, nada ambiguo | Socios (juridico) | Baixo | L2, L4, L5 |
| 5 | Repasse de UTM do anuncio ate o WhatsApp e o lead | Dev | Medio | T4 |
| 6 | Rodar o checklist tecnico do concorrente nas nossas 3 paginas | Dev | Baixo | C1-C6, A1-A4, P1-P3, B2 |
| 7 | Igualar forcas: contagem regressiva, barra fixa, vitrine do material | Dev + socios | Medio | seccao 3 |
| 8 | Pressionar a vantagem: autoridade local com rosto e nome | Socios + dev | Baixo | L3 (contraste) |

Donos: "Dev" e a Carajas Hubtech (quem mexe no codigo e no rastreio). "Socios" sao o Dr. Walter e o Dr. Diego; a validacao juridica (LGPD, CDC) cai melhor no Dr. Diego, que e advogado. No relatorio da auditoria, "Eryck" equivale ao nosso Dev e "Dr. Abrahao" a validacao juridica.

---

## Fase 1 - Antes de ligar qualquer anuncio (bloqueadores)

Nada de trafego pago sem estes tres itens resolvidos. Sao os que expoem a casa.

### 1.1 Travar o Pixel ate o consentimento (achado L1)
O pecado mais grave do concorrente: o Pixel da Meta dispara `PageView` com IP e identificadores no carregamento, sem banner, sem opcao de recusar (LGPD art. 7 e guia de cookies da ANPD).

**A nossa `guarda-maraba.html` esta pronta para cair no mesmo buraco.** Ela ja tem o bloco do Pixel (linhas 27 a 38) com `fbq('init','SEU_PIXEL_ID'); fbq('track','PageView')` no load. Hoje o ID e placeholder, entao nao dispara. **No dia em que a Carajas trocar o `SEU_PIXEL_ID` pelo ID real, a gente reproduz o L1 do concorrente.**

A fazer, antes de por o ID real:
- Banner de consentimento que segura o Pixel e qualquer tracker ate o aceite.
- So depois do opt-in o `fbq('init', ...)` e o `PageView` rodam. Os eventos de conversao que ja estao certos (`InitiateCheckout` na linha 553, `Lead` no cadastro gravado na linha 602) continuam, mas tambem so apos o aceite.
- Guardar a escolha da pessoa (aceitou/recusou) e respeitar na volta.

### 1.2 Pagina de privacidade (nao existe hoje)
O concorrente tem `privacidade.html` coerente (responsavel, contato, finalidades, direitos LGPD). **A gente nao tem** nenhuma na pasta `landing/`, e o nosso formulario ja coleta nome, WhatsApp e e-mail, com um texto de consentimento (guarda-maraba.html, por volta da linha 456) que nao aponta para politica nenhuma.

A fazer:
- Criar `automacao/landing/privacidade.html`: quem e o responsavel pelos dados (Juris Elite, com o CNPJ e o contato), o que coleta (formulario + Pixel, quando ligado), para que, por quanto tempo, e como pedir exclusao (o mesmo WhatsApp).
- Linkar essa pagina no rodape das tres e no texto de consentimento do formulario.

### 1.3 Aviso de independencia (achado L6)
O concorrente deixa claro no FAQ e no rodape que nao tem vinculo com a Prefeitura, a Guarda nem a Fadesp, e a auditoria achou isso adequado. **Nos nao temos esse aviso.** A nossa pagina ate cita "Prefeitura Municipal de Maraba e Fadesp" como fonte dos dados (linha 506), o que, sem a ressalva, pode ser lido como vinculo oficial.

A fazer: uma linha curta no rodape (e, se couber, no FAQ) das duas paginas da web: a Juris Elite e um preparatorio particular e independente, sem vinculo com a Prefeitura de Maraba, a Guarda Municipal ou a Fadesp. "Guarda Municipal de Maraba", "Fadesp" e afins sao citados apenas para referencia ao concurso.

### 1.4 Revisao de oferta e promessa (achados L2, L4, L5)
Licoes de redacao que o Dr. Diego valida antes de a mentoria ser anunciada:
- **Oferta sem ambiguidade (L2):** o concorrente poe um selo "+5 bonus inclusos" no topo quando so o plano caro tem os bonus. A nossa oferta e mais simples (Mapa gratis + uma mentoria de preco unico), mas vale a mesma regra: tudo o que o selo ou o hero prometer tem que valer para o que a pessoa de fato compra.
- **Nada de promessa absoluta (L4):** o concorrente escreveu "cada pena, prazo e numero de artigo foi conferido no texto oficial", e a propria auditoria mostrou que a conferencia das fontes municipais nao fechou. Regra nossa: afirmacao de que "tudo foi conferido" so entra com o lastro atras. O Mapa de Pontos ja traz "conferidos em 17/11/2026" - manter esse padrao de data e fonte.
- **Garantia como direito, nao como favor (L5):** se a mentoria oferecer os 7 dias, redigir como direito de arrependimento (CDC art. 49) e conferir se bate com as regras da Cakto.

---

## Fase 2 - Higiene tecnica e atribuicao

### 2.1 Repasse de UTM ate o fim do funil (achado T4)
O concorrente repassa `utm_source` e `sck` para o checkout da Cakto, e a atribuicao do anuncio sobrevive. O nosso equivalente e outro: a conversao nao e um checkout na pagina, e o clique no `wa.me` e, depois, o cadastro no formulario.

A fazer:
- Capturar os parametros de UTM na chegada da pagina.
- Levar a origem adiante: embutir no texto do link do WhatsApp e, principalmente, gravar junto com o lead (o atendente/CRM precisa saber de qual anuncio a pessoa veio). Sem isso, todo trafego pago chega como "origem desconhecida".

### 2.2 Checklist tecnico do concorrente, virado para dentro
A auditoria listou os defeitos tecnicos dele (C1 a C6, A1 a A4, P1 a P3, B2). Viram um checklist para rodar nas nossas tres paginas. O que ja conferi nesta rodada:

Ja acertamos (nao mexer, so manter):
- Metadados: `canonical`, `og:locale`, `twitter:card` presentes nas duas (o concorrente nao tinha - P3).
- `prefers-reduced-motion` ja zera o `scroll-behavior` (o concorrente esqueceu - C6).
- Sem A/B inerte, sem carrossel morto, sem o erro de idade do edital (E1): a nossa pagina nao afirma "18 a 35 na inscricao", entao a retificacao 02/2026 nao nos pega.

A conferir ainda (dev):
- Toda imagem abaixo da dobra com `loading="lazy"` (P1). As fotos dos socios ja entraram com lazy; varrer o resto.
- ARIA valido em qualquer aba/acordeao e nos `<details>` do FAQ (A1, A4).
- Um `<main>` e a hierarquia de titulos sem salto (A2).
- Contraste de texto >= 4,5:1, medido com ferramenta (A3).
- Fallback de texto onde algo so aparece por JavaScript (B2).
- Todos os arquivos referenciados retornando 200, sem link quebrado (a auditoria elogiou os 49 de 49 do concorrente).

---

## Fase 3 - Igualar as forcas do concorrente

A auditoria confirmou o que o concorrente faz bem. O que vale copiar como tatica (nao como produto):

- **Contagem regressiva para os prazos.** Ele tem, e a logica esta correta. A nossa campanha tem datas fortes (inscricao ate 28/12/2026, prova 24/01/2027). Uma contagem honesta na `guarda-maraba.html` aumenta urgencia sem mentir.
- **Barra fixa de CTA no celular.** Ele tem; a nossa conversao (receber o Mapa pelo WhatsApp) ganharia com um botao fixo no rodape do celular.
- **Vitrine visual do material.** O "giro" de mapas dele mostra o produto. O nosso produto de topo e o Mapa de Pontos e os cadernos; mostrar isso em imagem, e nao so em texto, ajuda.
- **Numeros do edital batendo com a fonte oficial.** A auditoria confirmou os dele contra o PDF. Manter os nossos conferidos e datados, e atualizar na retificacao (a 02/2026 mexeu so na idade minima; nao mudou a data da prova nem o resto).

---

## Fase 4 - Pressionar a nossa vantagem

Onde a gente ja ganha do concorrente, e deve bater mais forte:

- **Autoridade local, com rosto e nome.** A auditoria apontou que o concorrente usa depoimentos de outro produto (Guarulhos), com ressalva (L3). Nos temos dois juristas de verdade, da regiao, agora com foto na pagina: Dr. Walter Ruiz (delegado em atividade) e Dr. Diego Souza (advogado, professor e ex guarda municipal). Isso e prova social que ele nao tem. Vale uma linha curta ligando cada rosto ao que ele entrega na prova.
- **Entrada sem atrito.** O concorrente cobra pelo PDF logo na porta; nos damos o Mapa de Pontos de graca e so vendemos depois, na conversa. Deixar essa diferenca explicita ("comece de graca") e uma vantagem de conversao.
- **"Somos daqui".** O material municipal (20 pontos de Maraba, 5 leis da Guarda) que nenhuma plataforma nacional faz. Ja esta no texto; a autoridade dos socios da lastro a essa promessa.

---

## O que NAO vai para producao sem decisao dos socios

Espelhando a seccao 5 da auditoria, estes dependem de validacao juridica (Dr. Diego) antes de ir ao ar: o banner e a politica de privacidade (1.1 e 1.2), o aviso de independencia (1.3), a redacao da oferta e da garantia (1.4). O resto (atribuicao de UTM e a higiene tecnica da Fase 2) e decisao de dev e pode andar em paralelo.

23/11/2026.
