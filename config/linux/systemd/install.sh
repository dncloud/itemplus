#!/usr/bin/env bash

set -euo pipefail

SERVICE_NAME="itemplus"
SERVICE_USER="itemplus"
INSTALL_BIN="/usr/local/bin/itemplus-server"
INSTALL_SERVICE="/etc/systemd/system/${SERVICE_NAME}.service"
INSTALL_CONFIG_DIR="/etc/itemplus"
INSTALL_CONFIG_FILE="${INSTALL_CONFIG_DIR}/itemplus.conf"
STATE_DIR="/var/lib/itemplus"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_BIN="${1:-./itemplus-server}"
SOURCE_SERVICE="${SCRIPT_DIR}/itemplus.service"
SOURCE_ENV="${SCRIPT_DIR}/itemplus.conf.example"

generate_jwt_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 48 | tr -d '\n'
    return
  fi
  head -c 48 /dev/urandom | base64 | tr -d '\n'
}

ensure_jwt_secret() {
  if grep -Eq '^JWT_SECRET=.+$' "${INSTALL_CONFIG_FILE}" && ! grep -Eq '^JWT_SECRET=[[:space:]]*$' "${INSTALL_CONFIG_FILE}"; then
    return
  fi

  local secret
  local tmp
  secret="$(generate_jwt_secret)"
  tmp="$(mktemp)"
  awk -v secret="${secret}" '
    BEGIN { done = 0 }
    /^JWT_SECRET=/ {
      print "JWT_SECRET=" secret
      done = 1
      next
    }
    { print }
    END {
      if (!done) {
        print "JWT_SECRET=" secret
      }
    }
  ' "${INSTALL_CONFIG_FILE}" > "${tmp}"
  cat "${tmp}" > "${INSTALL_CONFIG_FILE}"
  rm -f "${tmp}"
}

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run this installer as root." >&2
  exit 1
fi

if [[ ! -f "${SOURCE_BIN}" ]]; then
  echo "Binary not found: ${SOURCE_BIN}" >&2
  echo "Pass the path to your built itemplus-server binary as the first argument." >&2
  exit 1
fi

if [[ ! -f "${SOURCE_SERVICE}" ]]; then
  echo "Service template not found: ${SOURCE_SERVICE}" >&2
  exit 1
fi

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  if command -v useradd >/dev/null 2>&1; then
    useradd --system --home "${STATE_DIR}" --create-home --shell /usr/sbin/nologin "${SERVICE_USER}" 2>/dev/null \
      || useradd --system --home "${STATE_DIR}" --create-home --shell /usr/bin/false "${SERVICE_USER}"
  else
    echo "useradd not found. Please create the ${SERVICE_USER} user manually." >&2
    exit 1
  fi
fi

install -d -m 0755 "${INSTALL_CONFIG_DIR}"
install -d -o "${SERVICE_USER}" -g "${SERVICE_USER}" -m 0750 "${STATE_DIR}"
install -d -o "${SERVICE_USER}" -g "${SERVICE_USER}" -m 0750 "${STATE_DIR}/data"
install -d -o "${SERVICE_USER}" -g "${SERVICE_USER}" -m 0750 "${STATE_DIR}/logs"

if [[ ! -f "${INSTALL_CONFIG_FILE}" ]]; then
  if [[ ! -f "${SOURCE_ENV}" ]]; then
    echo "Config template not found: ${SOURCE_ENV}" >&2
    exit 1
  fi
  install -m 0640 "${SOURCE_ENV}" "${INSTALL_CONFIG_FILE}"
  echo "Created ${INSTALL_CONFIG_FILE}. Review it before exposing item+ publicly."
fi
ensure_jwt_secret
chown root:"${SERVICE_USER}" "${INSTALL_CONFIG_FILE}"
chmod 0640 "${INSTALL_CONFIG_FILE}"

install -m 0755 "${SOURCE_BIN}" "${INSTALL_BIN}"
install -m 0644 "${SOURCE_SERVICE}" "${INSTALL_SERVICE}"
chown "${SERVICE_USER}:${SERVICE_USER}" "${STATE_DIR}" "${STATE_DIR}/data" "${STATE_DIR}/logs"

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"

echo
echo "item+ has been installed as a systemd service."
echo "Service: ${SERVICE_NAME}.service"
echo "Binary:  ${INSTALL_BIN}"
echo "State:   ${STATE_DIR}"
echo "Config:  ${INSTALL_CONFIG_FILE}"
echo
echo "Useful commands:"
echo "  systemctl status ${SERVICE_NAME}"
echo "  journalctl -u ${SERVICE_NAME} -f"
