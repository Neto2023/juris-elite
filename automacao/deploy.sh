#!/usr/bin/env bash
# Sobe a stack da Juris Elite numa VPS Ubuntu 24.04 recém-criada.
#
# Uso, a partir desta pasta, no Git Bash:
#     bash deploy.sh 123.45.67.89
#
# Nada de segredo é impresso na tela. As senhas do Postgres e da Evolution são
# geradas DENTRO da VPS e não trafegam por aqui. A chave da Anthropic é lida em
# modo silencioso e enviada por stdin do SSH, nunca como argumento de comando
# (argumento aparece em `ps` e no histórico do shell).
set -euo pipefail

IP="${1:-}"
USUARIO="${2:-root}"
DEST=/srv/juris-elite

if [ -z "$IP" ]; then
  echo "Uso: bash deploy.sh <IP_DA_VPS> [usuario]" >&2
  exit 1
fi

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -o StrictHostKeyChecking=accept-new "$USUARIO@$IP")

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

log "0/5 Testando o acesso SSH"
"${SSH[@]}" 'echo "conectado em $(hostname)"'

log "1/5 Enviando a stack para $DEST"
"${SSH[@]}" "mkdir -p $DEST"
# --exclude mantém .env, node_modules e lixo local fora do servidor.
tar -C "$AQUI" -czf - \
    --exclude='.env' --exclude='node_modules' --exclude='.git' \
    provisionar-vps.sh docker-compose.yml Dockerfile package.json README.md .env.example src assets 2>/dev/null \
  | "${SSH[@]}" "tar -C $DEST -xzf -"

log "2/5 Provisionando o sistema (Docker, firewall, SSH, swap)"
"${SSH[@]}" "bash $DEST/provisionar-vps.sh"

log "3/5 Coletando a configuração"
echo "As senhas do banco e da Evolution são geradas na própria VPS."
echo

read -rsp "Chave da API da Anthropic (sk-ant-...): " ANTHROPIC_KEY; echo
if [ -z "$ANTHROPIC_KEY" ]; then echo "Chave vazia. Abortando." >&2; exit 1; fi

read -rp  "Número da equipe p/ avisos (ex: 5594999998888): " EQUIPE
read -rp  "Link do grupo de WhatsApp (pode deixar vazio por ora): " GRUPO
read -rp  "URL do PDF do Mapa de Pontos (pode deixar vazio por ora): " MAPA
read -rp  "Nome da instância Evolution [juriselite]: " INSTANCIA
INSTANCIA="${INSTANCIA:-juriselite}"

log "4/5 Escrevendo o .env na VPS (modo 600, sem ecoar nada)"
# O heredoc com 'FIM' entre aspas não expande nada localmente; as variáveis
# marcadas com \$ são resolvidas no servidor. A chave entra por stdin.
printf '%s' "$ANTHROPIC_KEY" | "${SSH[@]}" "
  set -euo pipefail
  CHAVE=\$(cat)
  cd $DEST
  PG_PASS=\$(openssl rand -hex 24)
  EVO_KEY=\$(openssl rand -hex 24)
  umask 077
  cat > .env <<FIM
POSTGRES_USER=juris
POSTGRES_PASSWORD=\$PG_PASS
POSTGRES_DB=juris
EVOLUTION_SERVER_URL=http://juris-evolution:8080
EVOLUTION_API_KEY=\$EVO_KEY
EVOLUTION_INSTANCE=$INSTANCIA
ANTHROPIC_API_KEY=\$CHAVE
GRUPO_CONVITE_URL=$GRUPO
MAPA_PONTOS_URL=$MAPA
EQUIPE_WHATSAPP=$EQUIPE
PORT=3001
FIM
  chmod 600 .env
  echo '.env gravado com' \$(wc -l < .env) 'linhas, permissao' \$(stat -c %a .env)
"
unset ANTHROPIC_KEY

log "5/5 Subindo os containers"
"${SSH[@]}" "cd $DEST && docker compose up -d --build"

sleep 12
log "Verificação"
"${SSH[@]}" "
  echo '--- containers ---'
  docker ps --format '{{.Names}} | {{.Status}}'
  echo '--- saude do agente ---'
  curl -s --max-time 10 localhost:3001/health || echo 'agente ainda subindo, confira em instantes'
  echo
  echo '--- recursos ---'
  free -h | awk '/Mem:/{print \"RAM: \"\$3\" de \"\$2\" em uso\"}'
  df -h / | awk 'NR==2{print \"Disco: \"\$4\" livres\"}'
"

cat <<EOF

  Stack no ar.

  Para ler o QR code e conectar o número, abra um túnel SSH numa janela à parte:

      ssh -L 8080:127.0.0.1:8080 $USUARIO@$IP

  e, com o túnel aberto, acesse no navegador:

      http://localhost:8080/manager

  A chave da Evolution para entrar no manager está no .env da VPS:

      ssh $USUARIO@$IP "grep EVOLUTION_API_KEY $DEST/.env"

  Crie a instância com o nome "$INSTANCIA" e leia o QR com o celular do número
  da Juris Elite — um chip dedicado, nunca o WhatsApp pessoal de vocês.

EOF
