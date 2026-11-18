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
Landing ──POST /api/cadastro──▶ juris-agent ──▶ Postgres
                                     │
Candidato no WhatsApp ──webhook──────┤──▶ API Anthropic (claude-haiku-5-5)
                                     │
                              Evolution API ──▶ Mapa de Pontos + convite
```

O formulário da landing colhe nome, WhatsApp, e-mail e qual bloco do edital mais
preocupa o candidato, com aceite de LGPD guardado junto com a data e o texto
exato que foi aceito. O telefone é a chave do lead: quem se cadastra no site e
depois chama no WhatsApp cai na mesma linha da tabela.

O agente tem cinco ferramentas (`consultar_cronograma`, `enviar_mapa_de_pontos`,
`registrar_interesse`, `convidar_para_grupo`, `escalar_para_humano`) e **nunca
tira data de edital da memória do modelo**: tudo sai de uma tabela fixa em
`src/agente.js`.

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

Em desenvolvimento. A automação roda em VPS, a landing ainda não foi publicada,
e a instância de WhatsApp ainda não foi conectada à Evolution API.

## Licença e avisos

Código e identidade visual são de uso interno da Juris Elite. Sem vínculo com a
banca Fadesp nem com a Prefeitura Municipal de Marabá. Nenhum material aqui
garante aprovação em concurso.
