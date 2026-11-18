#!/usr/bin/env bash
# Provisiona uma VPS Ubuntu (24.04 ou 26.04 LTS) para a stack da Juris Elite.
# É idempotente: pode rodar de novo sem quebrar nada.
# Uso (como root, na VPS):
#   bash provisionar-vps.sh
set -euo pipefail

DEST=/srv/juris-elite

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

log "1/8 Atualizando o sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git ufw fail2ban unattended-upgrades jq

log "2/8 Docker"
if dpkg -s docker-ce >/dev/null 2>&1; then
  echo "docker-ce já instalado ($(docker --version)); pulando a instalação."
else
  echo "Instalando docker-ce do repositório oficial."
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.asc ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  cat >/etc/apt/sources.list.d/docker.list <<EOF
deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable
EOF
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
docker compose version >/dev/null || { echo "ERRO: plugin docker compose ausente" >&2; exit 1; }

log "3/8 Swap de 2 GB (evita OOM quando o Postgres e o Evolution sobem juntos)"
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
# Persiste em /etc/sysctl.d: o Ubuntu 26.04 não traz mais /etc/sysctl.conf.
sysctl -w vm.swappiness=10 >/dev/null
echo 'vm.swappiness=10' > /etc/sysctl.d/99-juris.conf

log "4/8 Firewall: só SSH entra"
# Evolution (8080) e o agente (3001) ficam publicados apenas em 127.0.0.1 pelo
# docker-compose, então NÃO precisam de regra aqui e não ficam expostos à internet.
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw --force enable

log "5/8 Endurecendo o SSH (somente chave)"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#\?KbdInteractiveAuthentication.*/KbdInteractiveAuthentication no/' /etc/ssh/sshd_config
# As imagens de nuvem deixam 50-cloud-init.conf com "PasswordAuthentication yes".
# No sshd a PRIMEIRA diretiva lida vence, e o Include fica no topo do sshd_config,
# então o arquivo precisa ordenar ANTES do 50- para valer. Daí o prefixo 00-.
if [ -d /etc/ssh/sshd_config.d ]; then
  printf 'PasswordAuthentication no\nPermitRootLogin prohibit-password\nKbdInteractiveAuthentication no\n' \
    > /etc/ssh/sshd_config.d/00-juris.conf
  rm -f /etc/ssh/sshd_config.d/99-juris.conf
fi
sshd -t && systemctl restart ssh

log "6/8 fail2ban e atualizações automáticas de segurança"
systemctl enable --now fail2ban
dpkg-reconfigure -f noninteractive unattended-upgrades

log "7/8 Preparando $DEST"
mkdir -p "$DEST"

log "8/8 Pronto"
cat <<EOF

  Docker:  $(docker --version)
  Compose: $(docker compose version --short)
  RAM:     $(free -h | awk '/Mem:/{print $2}')
  Disco:   $(df -h / | awk 'NR==2{print $4" livres de "$2}')

  Próximo passo: enviar a stack para $DEST e rodar
      cd $DEST && cp .env.example .env && nano .env && docker compose up -d

EOF
