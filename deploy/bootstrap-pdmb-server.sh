#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Запустите скрипт от root: sudo bash deploy/bootstrap-pdmb-server.sh"
  exit 1
fi

id -u pdmb >/dev/null 2>&1 || useradd --create-home --home-dir /opt/pdmb-bot --shell /bin/bash pdmb
install -d -o pdmb -g pdmb /opt/pdmb-bot/current
python3 -m venv /opt/pdmb-bot/venv
chown -R pdmb:pdmb /opt/pdmb-bot/venv
sudo -u pdmb /opt/pdmb-bot/venv/bin/pip install --upgrade pip
install -m 0644 deploy/pdmb-bot.service /etc/systemd/system/pdmb-bot.service
printf '%s\n' \
  'pdmb ALL=(root) NOPASSWD: /bin/systemctl restart pdmb-bot, /bin/systemctl is-active --quiet pdmb-bot' \
  > /etc/sudoers.d/pdmb-bot-deploy
chmod 0440 /etc/sudoers.d/pdmb-bot-deploy

if [[ ! -f /etc/pdmb-bot.env ]]; then
  install -m 0600 -o root -g root pdmb_bot/.env.example /etc/pdmb-bot.env
  echo "Заполните секреты в /etc/pdmb-bot.env перед запуском сервиса."
fi

systemctl daemon-reload
systemctl enable pdmb-bot.service
echo "Первичная настройка завершена. После заполнения env: systemctl start pdmb-bot"
