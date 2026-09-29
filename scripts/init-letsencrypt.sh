#!/usr/bin/env bash
# Первичный выпуск Let's Encrypt сертификата для стенда без домена — вместо
# домена используем sslip.io (49-12-80-137.sslip.io резолвится в реальный IP
# сервера), см. комментарий вверху nginx.config.
#
# Запускать один раз с сервера, из корня репозитория:
#   bash scripts/init-letsencrypt.sh
#
# certbot поднимает свой временный веб-сервер на порту 80 (--standalone),
# поэтому перед запуском останавливает nginx, если он уже работает. После
# получения сертификата поднимает (или пересобирает) весь проект — nginx
# стартует уже с готовым сертификатом в volume certbot_conf.
#
# Повторный запуск безопасен: certbot откажется перевыпускать ещё не
# истёкший сертификат. Продление раз в 12 часов делает отдельный сервис
# certbot в docker-compose.yaml.

set -euo pipefail

DOMAIN="49-12-80-137.sslip.io"
EMAIL="${LETSENCRYPT_EMAIL:-}"

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Не найден .env в корне репозитория — запускайте из клона проекта." >&2
  exit 1
fi

if docker compose ps -q nginx 2>/dev/null | grep -q .; then
  echo "==> Останавливаю nginx, чтобы освободить порт 80 для certbot..."
  docker compose stop nginx
fi

certbot_args=(certonly --standalone --non-interactive --agree-tos -d "$DOMAIN")
if [[ -n "$EMAIL" ]]; then
  certbot_args+=(--email "$EMAIL")
else
  certbot_args+=(--register-unsafely-without-email)
fi

echo "==> Запрашиваю сертификат для ${DOMAIN}..."
docker compose run --rm --entrypoint certbot -p 80:80 certbot "${certbot_args[@]}"

echo "==> Сертификат получен. Поднимаю проект..."
docker compose up -d --build

echo
echo "==================================================================="
echo "Готово: https://${DOMAIN}"
echo "Проверить статус контейнеров: docker compose ps"
echo "Логи бота (проверить подписку на webhook): docker compose logs -f bot"
echo "==================================================================="
