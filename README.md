# Juris Elite

Sistema de produção e captação da **Juris Elite**, preparatório para carreiras
jurídicas e concursos públicos em Marabá, Pará. Professores responsáveis:
**Prof. Walter Ruiz (Bogaz Neto)** e **Prof. Diego Souza**.

A linha de produto atual é a **Mentoria GMM Marabá**, voltada ao concurso da
Guarda Municipal de Marabá (Edital nº 01/2026, banca Fadesp, prova em
24/01/2027).

Este repositório traz o **sistema**, não o material vendido. Os cadernos, o
dossiê e o e-book ficam fora: o que está aqui é a máquina que os produz, e a
automação que conversa com o candidato.

---

## O que tem aqui

```
identidade/        A identidade visual como código
  sistema/           tokens, componentes, folha de impressão, fontes embutidas
  marca/             logotipo em suas variantes
automacao/         Captação e atendimento
  src/               agente de WhatsApp, endpoint de cadastro, banco
  landing/           página de captura, arquivo único
.claude/skills/    A regra da casa, legível por humano e por agente
```

### Identidade como código

`identidade/sistema/` é a fonte única de verdade de cor, tipografia, espaço e
forma. Nenhuma peça define cor em hexadecimal solto: usa variável.

| Arquivo | Para que serve |
|---|---|
| `tokens.css` | Paleta, escala tipográfica, espaço, forma. Claro e escuro. |
| `componentes.css` | Cabeçalho, alerta, mnemônico, tabela, rodapé |
| `impresso.css` | Folha A4: capa, seção, questão, gabarito, texto de lei |
| `fontes.css` | Playfair Display, Source Serif 4 e Inter **embutidas em base64** |

As fontes vão embutidas por um motivo prático: com arquivo externo, o Chrome em
modo headless às vezes imprime o PDF antes de a face chegar, e a peça sai em
fonte de sistema sem avisar ninguém. O defeito era intermitente, que é pior que
constante.

**Geradores:**

```bash
python identidade/sistema/gerar-pdf.py  <peca>.html            # PDF A4
python identidade/sistema/gerar-docx.py <peca>.html <saida>.docx
python identidade/sistema/converter-legado.py tudo             # material antigo
```

O `gerar-pdf.py` sobe um servidor local e imprime por `http://127.0.0.1`, e não
pelo `file://`, porque o Chrome trata `file://` como origem opaca e recusa, por
CORS, o download das fontes. Ao final ele confere quais famílias ficaram
embutidas no PDF e avisa se alguma caiu em fonte de fallback.

### Automação de captação

```
juriselite.com.br ──nginx──┬──▶ site estático
                           └──/api/──▶ juris-agent ──▶ Postgres
                                            │
Candidato no WhatsApp ──webhook─────────────┤──▶ API Anthropic (claude-haiku-5-5)
                                            │
                                     Evolution API ──▶ checkout, formulário, convite
```

O formulário da landing colhe nome, WhatsApp, e-mail e qual bloco do edital mais
preocupa o candidato, com aceite de LGPD guardado junto com a data e o texto
exato que foi aceito. O telefone é a chave do lead: quem se cadastra no site e
depois chama no WhatsApp cai na mesma linha da tabela.

O agente tem sete ferramentas (`consultar_catalogo`, `consultar_cronograma`,
`enviar_mapa_de_pontos`, `registrar_interesse`, `convidar_para_grupo`,
`enviar_checkout`, `escalar_para_humano`) e **nunca tira preço nem data da
memória do modelo**: catálogo e cronograma saem de tabelas fixas em
`src/agente.js`. Foi de memória que nasceu um preço de R$ 197 que não existia,
dito a uma candidata que já tinha fechado por R$ 9,99.

O papel dele é recepção de vendas, não professor: oferta os dois produtos da
prateleira, manda o link de checkout da Cakto e chama a equipe. É proibido de
montar cronograma de graça, de entregar material antes do pagamento e de
confirmar que um pagamento caiu.

**A equipe assume a conversa de dentro dela**, como no atendimento do cartório:
`/assumir` cala o agente ali, `/agente` devolve, `/confirmado` libera o aluno
depois de a equipe conferir um comprovante. Responder na mão, sem comando
nenhum, também cala o agente naquela conversa. A regra de quem fala está
isolada em `src/conducao.js`, que é puro e tem teste.

Testes da validação, sem Docker e sem banco:

```bash
cd automacao && node --test src/validacao.test.js
```

Instalação na VPS, variáveis de ambiente e operação do dia a dia estão em
[`automacao/README.md`](automacao/README.md).

---

## O que não está aqui, e por quê

| Fora do repositório | Motivo |
|---|---|
| `material/` | Cadernos, dossiê e e-book. É o produto que a casa vende. |
| `material-base/` | Acervo dos professores e matriz de questões de terceiros. |
| `plano-funil.html` | Plano comercial: preços, verba, projeção, concorrência. |
| Credenciais e `.env` | Repositório público. Segredo que vaza, vaza para sempre. |

---

## Estado

> **Último registro:** 20 de novembro de 2026. Site no domínio próprio com
> HTTPS, atendente vendendo pelo checkout da Cakto, em bancada de teste.

Em operação assistida. O site está em **https://juriselite.com.br**, servido
por nginx na VPS com certificado Let's Encrypt e renovação automática, e o
formulário da campanha fala com o agente pelo mesmo domínio.

O atendente está **em bancada de teste**: responde só aos cinco números da
equipe, por `NUMEROS_LIBERADOS`. A liberação geral depende de a equipe passar
a rodada de testes. Falta trocar as credenciais expostas.

### Últimas mudanças

**20/11/2026 - O domínio entrou, e o site saiu do GitHub Pages.** nginx na
VPS servindo `juriselite.com.br` e `www`, certificado Let's Encrypt com
renovação automática, `http` redirecionando para `https`, e `/api/` passando
para o `juris-agent` com `X-Forwarded-For`. Sem esse cabeçalho o freio por IP
do cadastro trataria o mundo inteiro como um visitante só, e o quinto cadastro
do dia travaria todos os outros. Junto, o menu do celular: a caixa de
referência de um absoluto já inclui a margem lateral do pai, e a regra puxava
pela margem de novo, somando duas vezes e jogando o menu 40px além da tela.
Medido antes e depois. Tocado: `automacao/landing/index.html`.

**20/11/2026 - Pagamento vira checkout da Cakto, e o catálogo vira o dos
professores.** Briefing respondido pelo Dr. Walter e pelo Dr. Diego virou
tabela: os dois produtos da prateleira, com prazo de acesso, formato, quem
atende e o que o aluno leva. `enviar_pix` saiu e entrou `enviar_checkout`, que
manda o link da Cakto com o nome do produto e o valor. A chave Pix avulsa
acabou. O agente avisa antes que no Pix o recebedor aparece como o professor,
e que o nome do produto na tela de pagamento é outro: as duas coisas derrubam
venda quando a pessoa descobre na hora de pagar. Tocado: `agente.js`.

**19/11/2026 - A equipe entra na conversa, e o comprovante não se perde.**
`/assumir`, `/agente` e `/confirmado`, digitados dentro da conversa. Imagem
sem legenda era descartada por um `return` silencioso: a pessoa pagava,
mandava o print e ninguém via. Agora o arquivo chega, a equipe é avisada com o
produto e o valor, e o agente só volta a falar depois do `/confirmado`. A
trava que cala o agente no meio da resposta passou a distinguir gente
assumindo de escalação dele mesmo, que engolia a própria frase de despedida.
Tocado: `conducao.js`, `server.js`, `db.js`, `agente.js`. 16 testes.

**18/11/2026 - Trava do convite por frente.** O convite do grupo virou o
primeiro passo do atendimento, e isso abriu um buraco: quem chegasse
perguntando de OAB receberia convite de um grupo da Guarda antes de ser
ouvido. O agente agora só convida quem veio pela Guarda de Marabá; as outras
frentes são acolhidas e escaladas para um professor. Tocado:
`automacao/src/agente.js` (prompt e descrição de `convidar_para_grupo`).
Validado com `src/validar-ferramentas.js` e `/health`.

**18/11/2026 - O atendente fala primeiro, e com ritmo de gente.** As
ferramentas deixaram de enviar na hora em que são chamadas: agora enfileiram
em `pendentes`, e o servidor solta link, PDF e Pix só depois da fala do
agente. Junto, `espera()` e `digitando()` em `automacao/src/server.js`, com
pausa proporcional ao tamanho do texto. Tocado: `agente.js`, `server.js`.

**18/11/2026 - O grupo virou a porta de entrada.** Quem se cadastra na landing
recebe o convite do grupo, e o Mapa de Pontos fica na descrição do grupo,
porque o WhatsApp esconde o histórico de quem entra depois. O PDF direto
passou a ser exceção, para quem recusa grupo.

**18/11/2026 - Schema que derrubava o atendimento.** `registrar_interesse`
declarava `type: [string,null]` junto com um `enum` de strings, o que a
API recusa sob `strict: true`. Não falhava no boot nem nos testes: falhava no
meio da primeira conversa, e o candidato ficava sem resposta. Corrigido com
`anyOf`, e nasceu `src/validar-ferramentas.js` para pegar isso sem gastar
conversa real.

## Licença e avisos

Código e identidade visual são de uso interno da Juris Elite. Sem vínculo com a
banca Fadesp nem com a Prefeitura Municipal de Marabá. Nenhum material aqui
garante aprovação em concurso.
