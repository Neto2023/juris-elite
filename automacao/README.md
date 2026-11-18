# Juris Elite — automação de WhatsApp

Atendente de WhatsApp que captura, qualifica e etiqueta candidatos do concurso da
Guarda Municipal de Marabá, alimentando o funil descrito em `../plano-funil.html`.

## Como funciona

```
Candidato no WhatsApp
        │
        ▼
  juris-evolution ──webhook──▶ juris-agent ──▶ API Anthropic (claude-haiku-5-5)
  (Evolution API,                  │                    │
   Baileys por baixo)              │              5 ferramentas
        ▲                          ▼                    │
        └────── resposta ───── juris-postgres ◀──────────┘
                               (leads, mensagens, eventos)
```

O agente tem cinco ferramentas: `consultar_cronograma`, `enviar_mapa_de_pontos`,
`registrar_interesse`, `convidar_para_grupo` e `escalar_para_humano`.

**Todas as datas e regras do edital saem de uma tabela fixa em `src/agente.js`,
nunca da memória do modelo.** Se o edital for retificado, edite a constante
`CRONOGRAMA` e reinicie o container — é o único lugar a mudar.

## Cadastro pela landing

A landing (`landing/index.html`) não manda mais ninguém direto para o WhatsApp.
Os botões levam ao formulário, e o formulário colhe **nome, WhatsApp, e-mail** e
**qual bloco mais preocupa** o candidato, que é o campo que define a régua de
conteúdo dele depois. Só então a pessoa é levada à conversa.

```
Formulário  ──POST /api/cadastro──▶  juris-agent
                                          │
                     grava o lead ────────┤  (origem 'landing', estágio 'qualificado')
                                          │
                     Evolution  ◀─────────┘  manda o Mapa de Pontos
                                             e o convite do grupo
```

O telefone é a chave do lead, aqui e no WhatsApp. Quem se cadastra no site e
depois chama no número cai na **mesma linha** da tabela `leads`, de modo que o
agente trate um conhecido como conhecido. Campo já preenchido nunca é
sobrescrito por vazio.

**Se a gravação falhar**, o formulário não finge que deu certo: avisa a pessoa e
manda ela para o WhatsApp, onde o atendimento recomeça. Ninguém se perde porque
o banco caiu.

Variável nova no `.env`:

```
ORIGENS_PERMITIDAS=https://juriselite.com.br,https://www.juriselite.com.br
```

Sem ela, qualquer site enche sua base de leads falsos. O endpoint também tem
freio por IP (cinco cadastros a cada dez minutos) e um campo-armadilha invisível
para robô.

Para testar a validação sem subir nada:

```bash
node --test src/validacao.test.js
```

## Custo do modelo

`claude-haiku-5-5` custa US$ 0,10 por milhão de tokens de entrada e US$ 0,50 por
milhão de saída. O prompt do sistema é marcado com `cache_control`, então a
partir da segunda mensagem de cada conversa a maior parte da entrada é lida do
cache, bem mais barato. Na prática, milhares de atendimentos custam poucos dólares.
Confira o consumo real em:

```sql
SELECT sum((dados->>'entrada')::int)       AS tokens_entrada,
       sum((dados->>'saida')::int)         AS tokens_saida,
       sum((dados->>'cache_leitura')::int) AS lidos_do_cache
FROM eventos WHERE tipo = 'uso_modelo';
```

Se `lidos_do_cache` ficar em zero, o cache não está pegando — avise.

## Instalação na VPS

Ubuntu 24.04 LTS limpa, como root:

```bash
scp -r automacao root@SEU_IP:/srv/juris-elite
```

```bash
ssh root@SEU_IP 'bash /srv/juris-elite/provisionar-vps.sh'
```

Depois configure o ambiente e suba:

```bash
ssh root@SEU_IP 'cd /srv/juris-elite && cp .env.example .env && openssl rand -hex 24'
```

Edite o `.env` preenchendo `POSTGRES_PASSWORD`, `EVOLUTION_API_KEY`,
`ANTHROPIC_API_KEY`, `GRUPO_CONVITE_URL`, `MAPA_PONTOS_URL` e `EQUIPE_WHATSAPP`.

```bash
ssh root@SEU_IP 'cd /srv/juris-elite && docker compose up -d --build'
```

## Conectar o número de WhatsApp

A Evolution fica publicada apenas em `127.0.0.1` — não está exposta à internet.
Para ler o QR code, abra um túnel SSH a partir da sua máquina:

```bash
ssh -L 8080:127.0.0.1:8080 root@SEU_IP
```

Com o túnel aberto, acesse `http://localhost:8080/manager` no navegador, entre com
a `EVOLUTION_API_KEY`, crie a instância com o nome que está em `EVOLUTION_INSTANCE`
e leia o QR code com o celular do número da Juris Elite.

> Use um chip dedicado ao projeto. Não conecte o WhatsApp pessoal de vocês.

## Operação do dia a dia

Saúde dos serviços:

```bash
ssh root@SEU_IP 'curl -s localhost:3001/health; docker ps --format "{{.Names}} | {{.Status}}"'
```

Como está o funil:

```bash
ssh root@SEU_IP 'curl -s localhost:3001/funil'
```

Quem pediu atendimento humano e ainda não foi respondido:

```bash
ssh root@SEU_IP "docker exec juris-postgres psql -U juris -d juris -c \"SELECT telefone, nome, etiqueta, atualizado_em FROM leads WHERE escalado ORDER BY atualizado_em DESC LIMIT 20;\""
```

Erros da última hora:

```bash
ssh root@SEU_IP 'docker logs juris-agent --since 1h 2>&1 | grep -iE "erro|error|falhou" | tail -20'
```

Backup do banco:

```bash
ssh root@SEU_IP 'docker exec juris-postgres pg_dump -U juris juris | gzip > /root/juris-$(date +%F).sql.gz'
```

## Segurança

- Só a porta 22 aceita conexão de fora; Evolution e agente ficam no loopback.
- SSH só por chave: senha e teclado-interativo desligados pelo script.
- O `.env` guarda a chave da Anthropic e a senha do banco. Não versione, não
  mande por WhatsApp, e troque a `ANTHROPIC_API_KEY` se ela vazar.
- Ponha um limite de gasto mensal no console da Anthropic antes de abrir o
  número ao público. É a trava que evita susto na fatura.

## Conformidade

- O atendente nunca promete aprovação e não dá consultoria jurídica individual —
  está no prompt do sistema e é regra de negócio, não detalhe de estilo.
- Mensagem automática só para quem iniciou a conversa. Disparo em massa para
  quem nunca falou com vocês é o caminho mais rápido para o número ser banido.
- Os dados dos candidatos são pessoais (LGPD): coleta com finalidade declarada,
  e todo contato precisa de um jeito simples de sair da lista.
- O consentimento do formulário é guardado com **data e com o texto exato** que a
  pessoa aceitou, nas colunas `consentimento_em` e `consentimento_texto`. O texto
  fica no banco, e não só na página, porque a página muda e o que foi consentido
  não pode mudar junto. Consentimento que não se prova não existe.
- A caixa de aceite nasce **desmarcada** e não há cadastro sem ela. Caixa
  pré-marcada não é consentimento livre.
- Para atender um pedido de exclusão:

  ```sql
  DELETE FROM leads WHERE telefone = '55949XXXXXXXX';
  ```

  As mensagens e os eventos caem junto, por `ON DELETE CASCADE`.
