-- Schema da base de leads da Juris Elite.
-- Carregado automaticamente pelo Postgres na primeira subida do volume.

CREATE SCHEMA IF NOT EXISTS evolution;

CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL PRIMARY KEY,
  telefone        TEXT        NOT NULL UNIQUE,   -- só dígitos, formato internacional
  nome            TEXT,
  email           TEXT,
  origem          TEXT        NOT NULL DEFAULT 'whatsapp',
  -- LGPD: guardamos QUANDO a pessoa consentiu e o TEXTO exato que ela aceitou.
  -- Sem isso o consentimento não se prova, e consentimento que não se prova
  -- não existe. O texto fica aqui, e não só na página, porque a página muda.
  consentimento_em    TIMESTAMPTZ,
  consentimento_texto TEXT,
  -- Qual bloco mais preocupa o candidato. Define a régua de conteúdo que ele recebe.
  etiqueta        TEXT        CHECK (etiqueta IN ('direito','maraba','basicas','rotina')),
  -- Onde o lead está no funil.
  estagio         TEXT        NOT NULL DEFAULT 'novo'
                              CHECK (estagio IN ('novo','qualificado','no_grupo','comprador','perdido')),
  mapa_enviado    BOOLEAN     NOT NULL DEFAULT FALSE,
  convite_enviado BOOLEAN     NOT NULL DEFAULT FALSE,
  escalado        BOOLEAN     NOT NULL DEFAULT FALSE,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_estagio_idx  ON leads (estagio);
CREATE INDEX IF NOT EXISTS leads_etiqueta_idx ON leads (etiqueta);
CREATE INDEX IF NOT EXISTS leads_criado_idx   ON leads (criado_em DESC);
CREATE INDEX IF NOT EXISTS leads_origem_idx   ON leads (origem);
-- E-mail NÃO é único: o telefone é a chave da pessoa, e duas pessoas da mesma
-- casa podem se cadastrar com o mesmo e-mail. Índice só para busca.
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (lower(email)) WHERE email IS NOT NULL;

-- Histórico de conversa. É daqui que o agente remonta o contexto a cada mensagem.
CREATE TABLE IF NOT EXISTS mensagens (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    BIGINT      NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direcao    TEXT        NOT NULL CHECK (direcao IN ('recebida','enviada')),
  conteudo   TEXT        NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mensagens_lead_idx ON mensagens (lead_id, criado_em);

-- Trilha de auditoria: toda ação de ferramenta do agente vira um evento.
CREATE TABLE IF NOT EXISTS eventos (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    BIGINT      REFERENCES leads(id) ON DELETE CASCADE,
  tipo       TEXT        NOT NULL,
  dados      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eventos_lead_idx ON eventos (lead_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS eventos_tipo_idx ON eventos (tipo, criado_em DESC);

-- Evita processar duas vezes a mesma mensagem quando a Evolution reenvia o webhook.
CREATE TABLE IF NOT EXISTS mensagens_processadas (
  evolution_id TEXT PRIMARY KEY,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION toca_atualizado_em() RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_atualizado_em ON leads;
CREATE TRIGGER leads_atualizado_em
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION toca_atualizado_em();

-- Painel rápido do funil: SELECT * FROM funil;
CREATE OR REPLACE VIEW funil AS
SELECT
  estagio,
  etiqueta,
  count(*) AS total,
  count(*) FILTER (WHERE criado_em > now() - interval '7 days') AS ultimos_7_dias
FROM leads
GROUP BY estagio, etiqueta
ORDER BY estagio, etiqueta;
