import pg from "pg";

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || "juris-postgres",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  max: 10,
});

pool.on("error", (e) => console.error("[postgres] erro no pool:", e.message));

export async function ping() {
  const { rows } = await pool.query("SELECT 1 AS ok");
  return rows[0].ok === 1;
}

/**
 * O schema.sql só roda na PRIMEIRA subida do volume do Postgres. Numa base que
 * já existe, coluna nova nunca apareceria. Então as mudanças de schema vêm
 * também aqui, em forma idempotente, e rodam a cada boot do agente.
 */
export async function garantirEsquema() {
  await pool.query(`
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS email               TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS consentimento_em    TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS consentimento_texto TEXT;
    -- Quem está conduzindo ESTA conversa: 'agente' ou 'equipe'. Enquanto
    -- estiver com a equipe, o atendente automático não fala, nem para
    -- cumprimentar. Volta só com /agente, digitado dentro da conversa.
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS conduz       TEXT NOT NULL DEFAULT 'agente';
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS conduz_desde TIMESTAMPTZ;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS conduz_nota  TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS pagamento_item   TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS pagamento_estado TEXT;
    CREATE INDEX IF NOT EXISTS leads_conduz_idx ON leads (conduz);
    CREATE INDEX IF NOT EXISTS leads_origem_idx ON leads (origem);
    CREATE INDEX IF NOT EXISTS leads_email_idx  ON leads (lower(email)) WHERE email IS NOT NULL;
  `);
}

/**
 * Cadastro vindo do formulário da landing.
 *
 * O telefone continua sendo a chave: quem se cadastra no site e depois chama no
 * WhatsApp é a mesma pessoa, e tem de cair na mesma linha, senão o agente
 * trata um conhecido como desconhecido. Por isso é upsert por telefone, e não
 * insert. Campo preenchido não é sobrescrito por vazio.
 */
export async function registrarCadastro({ telefone, nome, email, etiqueta, consentimentoTexto }) {
  const { rows } = await pool.query(
    `INSERT INTO leads (telefone, nome, email, etiqueta, origem,
                        consentimento_em, consentimento_texto, estagio)
     VALUES ($1, $2, $3, $4, 'landing', now(), $5, 'qualificado')
     ON CONFLICT (telefone) DO UPDATE SET
       nome                = COALESCE(EXCLUDED.nome, leads.nome),
       email               = COALESCE(EXCLUDED.email, leads.email),
       etiqueta            = COALESCE(EXCLUDED.etiqueta, leads.etiqueta),
       consentimento_em    = COALESCE(leads.consentimento_em, EXCLUDED.consentimento_em),
       consentimento_texto = COALESCE(leads.consentimento_texto, EXCLUDED.consentimento_texto),
       estagio             = CASE WHEN leads.estagio = 'novo' THEN 'qualificado'
                                  ELSE leads.estagio END
     RETURNING *,
       (xmax = 0) AS novo`,
    [telefone, nome || null, email || null, etiqueta || null, consentimentoTexto || null],
  );
  return rows[0];
}

export async function obterOuCriarLead(telefone, nomeWhatsapp) {
  const { rows } = await pool.query(
    `INSERT INTO leads (telefone, nome)
     VALUES ($1, $2)
     ON CONFLICT (telefone) DO UPDATE
       SET nome = COALESCE(leads.nome, EXCLUDED.nome)
     RETURNING *`,
    [telefone, nomeWhatsapp || null],
  );
  return rows[0];
}

/** Atualiza só as colunas passadas. Lista branca para não aceitar nome de coluna vindo do modelo. */
const COLUNAS = new Set([
  "nome",
  "etiqueta",
  "estagio",
  "mapa_enviado",
  "convite_enviado",
  "escalado",
  "conduz",
  "conduz_nota",
  "pagamento_item",
  "pagamento_estado",
  "observacoes",
]);

export async function marcarLead(leadId, campos) {
  const entradas = Object.entries(campos).filter(([k]) => COLUNAS.has(k));
  if (entradas.length === 0) return;
  const sets = entradas.map(([k], i) => `${k} = $${i + 2}`).join(", ");
  await pool.query(
    `UPDATE leads SET ${sets} WHERE id = $1`,
    [leadId, ...entradas.map(([, v]) => v)],
  );
}

/**
 * Passa a conversa para 'equipe' ou devolve para 'agente'.
 *
 * Não há expiração automática de propósito: conversa que a equipe assumiu só
 * volta quando alguém digitar /agente. Devolver sozinho, depois de um prazo,
 * seria o robô voltando a falar no meio de uma negociação que ele não viu.
 */
export async function definirConducao(leadId, quem, nota = null) {
  const valor = quem === "equipe" ? "equipe" : "agente";
  await pool.query(
    "UPDATE leads SET conduz = $2, conduz_desde = now(), conduz_nota = $3 WHERE id = $1",
    [leadId, valor, nota],
  );
  return valor;
}

/** Quem conduz a conversa agora: 'agente' ou 'equipe'. Leitura fresca. */
/**
 * Em que pé está a compra: qual item e qual estado.
 *
 * "pix_enviado" a chave saiu, "comprovante" chegou o print e a equipe precisa
 * conferir, "confirmado" alguém da equipe conferiu e liberou o material.
 */
export async function marcarPagamento(leadId, estado, item) {
  const campos = { pagamento_estado: estado };
  if (item) campos.pagamento_item = item;
  await marcarLead(leadId, campos);
}

/** Quem conduz a conversa agora, junto da nota de quem assumiu. */
export async function conduzDetalhe(leadId) {
  const { rows } = await pool.query(
    "SELECT conduz, conduz_nota FROM leads WHERE id = $1",
    [leadId],
  );
  return {
    conduz: rows[0]?.conduz || "agente",
    nota: rows[0]?.conduz_nota || null,
  };
}

export async function conduzAtual(leadId) {
  const { rows } = await pool.query("SELECT conduz FROM leads WHERE id = $1", [leadId]);
  return rows[0]?.conduz || "agente";
}

/** Lê o lead pelo telefone sem criar linha nova. */
export async function obterLeadPorTelefone(telefone) {
  const { rows } = await pool.query("SELECT * FROM leads WHERE telefone = $1", [telefone]);
  return rows[0] || null;
}

/**
 * Guarda o id de uma mensagem que NÓS enviamos.
 *
 * A Evolution devolve pelo webhook tudo que sai do número, inclusive o que o
 * próprio agente mandou. Sem isto, o agente leria a própria fala como se
 * fosse a equipe digitando e se calaria sozinho na primeira resposta.
 */
export async function conheceEnvio(evolutionId) {
  if (!evolutionId) return false;
  const { rowCount } = await pool.query(
    "SELECT 1 FROM mensagens_processadas WHERE evolution_id = $1",
    [evolutionId],
  );
  return rowCount > 0;
}

export async function registrarNossoEnvio(evolutionId) {
  if (!evolutionId) return;
  await pool.query(
    "INSERT INTO mensagens_processadas (evolution_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [evolutionId],
  );
}

export async function salvarMensagem(leadId, direcao, conteudo) {
  await pool.query(
    "INSERT INTO mensagens (lead_id, direcao, conteudo) VALUES ($1, $2, $3)",
    [leadId, direcao, conteudo],
  );
}

/** Últimas N mensagens, em ordem cronológica, para remontar o contexto. */
export async function historico(leadId, limite = 20) {
  const { rows } = await pool.query(
    `SELECT direcao, conteudo FROM (
       SELECT direcao, conteudo, criado_em
       FROM mensagens WHERE lead_id = $1
       ORDER BY criado_em DESC LIMIT $2
     ) t ORDER BY criado_em ASC`,
    [leadId, limite],
  );
  return rows;
}

export async function registrarEvento(leadId, tipo, dados = {}) {
  await pool.query(
    "INSERT INTO eventos (lead_id, tipo, dados) VALUES ($1, $2, $3)",
    [leadId, tipo, JSON.stringify(dados)],
  );
}

/** true quando esta mensagem já foi processada (a Evolution reenvia webhooks). */
export async function jaProcessada(evolutionId) {
  if (!evolutionId) return false;
  const { rowCount } = await pool.query(
    "INSERT INTO mensagens_processadas (evolution_id) VALUES ($1) ON CONFLICT DO NOTHING",
    [evolutionId],
  );
  return rowCount === 0;
}

export async function resumoFunil() {
  const { rows } = await pool.query("SELECT * FROM funil");
  return rows;
}
