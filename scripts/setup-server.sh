#!/usr/bin/env bash
# Готовит чистый Ubuntu/Debian сервер под деплой этого проекта:
#   1) обновляет систему
#   2) ставит Docker Engine + Compose plugin из официального репозитория Docker
#   3) генерирует SSH deploy-key для git (и алиас в ~/.ssh/config)
#
# Использование (на сервере, из-под sudo или root):
#   sudo bash scripts/setup-server.sh
#
# Скрипт идемпотентен — повторный запуск ничего не сломает и не перезапишет
# уже существующий ключ.

set -euo pipefail

# ---- 0. Проверки --------------------------------------------------------

if [[ $EUID -ne 0 ]]; then
  echo "Запустите с правами root: sudo bash $0" >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Не найден /etc/os-release — скрипт поддерживает только Ubuntu/Debian." >&2
  exit 1
fi

# shellcheck source=/dev/null
. /etc/os-release
DISTRO_ID="$ID"

case "$DISTRO_ID" in
  ubuntu|debian) ;;
  *)
    echo "Дистрибутив '$DISTRO_ID' не поддерживается (нужен ubuntu или debian)." >&2
    exit 1
    ;;
esac

# Пользователь, для которого создаём ключ и которого добавляем в группу
# docker — тот, кто вызвал sudo, а не root.
TARGET_USER="${SUDO_USER:-root}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)

echo "==> Дистрибутив: $PRETTY_NAME"
echo "==> Целевой пользователь: $TARGET_USER ($TARGET_HOME)"

# ---- 1. Обновление системы ----------------------------------------------

echo "==> Обновляю списки пакетов и систему..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg git

# ---- 2. Установка Docker --------------------------------------------------

if command -v docker &>/dev/null; then
  echo "==> Docker уже установлен ($(docker --version)), пропускаю установку."
else
  echo "==> Устанавливаю Docker Engine из официального репозитория..."

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${DISTRO_ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  ARCH=$(dpkg --print-architecture)
  CODENAME="${VERSION_CODENAME:-$(. /etc/os-release && echo "$VERSION_CODENAME")}"

  echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${DISTRO_ID} ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable --now docker
  echo "==> Docker установлен: $(docker --version)"
fi

if [[ "$TARGET_USER" != "root" ]]; then
  if ! id -nG "$TARGET_USER" | grep -qw docker; then
    usermod -aG docker "$TARGET_USER"
    echo "==> Пользователь $TARGET_USER добавлен в группу docker (перелогиньтесь, чтобы применилось)."
  fi
fi

# ---- 3. SSH deploy-key для git --------------------------------------------

SSH_DIR="${TARGET_HOME}/.ssh"
KEY_PATH="${SSH_DIR}/id_ed25519_deploy"
KEY_COMMENT="deploy@$(hostname -f 2>/dev/null || hostname)"

install -d -m 700 -o "$TARGET_USER" -g "$TARGET_USER" "$SSH_DIR"

if [[ -f "$KEY_PATH" ]]; then
  echo "==> Deploy-key уже существует: $KEY_PATH, пропускаю генерацию."
else
  echo "==> Генерирую SSH deploy-key (ed25519)..."
  sudo -u "$TARGET_USER" ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "$KEY_COMMENT"
fi

# Алиас в ~/.ssh/config, чтобы git обращался к github.com именно этим ключом,
# не трогая остальные ключи пользователя на машине.
SSH_CONFIG="${SSH_DIR}/config"
ALIAS_HOST="github.com-deploy"

if ! grep -q "Host ${ALIAS_HOST}" "$SSH_CONFIG" 2>/dev/null; then
  {
    echo ""
    echo "Host ${ALIAS_HOST}"
    echo "    HostName github.com"
    echo "    User git"
    echo "    IdentityFile ${KEY_PATH}"
    echo "    IdentitiesOnly yes"
  } >> "$SSH_CONFIG"
  chown "$TARGET_USER":"$TARGET_USER" "$SSH_CONFIG"
  chmod 600 "$SSH_CONFIG"
  echo "==> Добавлен алиас '${ALIAS_HOST}' в ${SSH_CONFIG}"
fi

# ---- Итог ------------------------------------------------------------------

echo
echo "==================================================================="
echo "Готово. Публичный ключ для GitHub → Settings → Deploy keys:"
echo
cat "${KEY_PATH}.pub"
echo
echo "Клонировать репозиторий этим ключом:"
echo "  git clone ${ALIAS_HOST}:<org>/<repo>.git"
echo "  # то есть вместо git@github.com:<org>/<repo>.git подставьте ${ALIAS_HOST}"
echo "==================================================================="
