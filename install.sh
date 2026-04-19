#!/bin/bash
# DeckBox installer — run this on your Steam Deck in Desktop Mode (Konsole)
# Usage: curl -fL https://github.com/D3FVLT/DeckBox/releases/latest/download/install.sh | bash

set -e

PLUGIN_DIR="${HOME}/homebrew/plugins"
SINGBOX_VERSION="1.11.0"
SINGBOX_URL="https://github.com/SagerNet/sing-box/releases/download/v${SINGBOX_VERSION}/sing-box-${SINGBOX_VERSION}-linux-amd64.tar.gz"
RELEASE_URL="https://github.com/D3FVLT/DeckBox/releases/latest/download/DeckBox.zip"
TMP_DIR="/tmp/deckbox_install"
SETTINGS_DIR="${HOME}/homebrew/settings/DeckBox"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# Download plugin
echo "[DeckBox] Downloading plugin..."
curl -fL --progress-bar -o "${TMP_DIR}/DeckBox.zip" "$RELEASE_URL" || { echo "[DeckBox] ERROR: Plugin download failed."; exit 1; }

echo "[DeckBox] Extracting plugin..."
unzip -o "${TMP_DIR}/DeckBox.zip" -d "$TMP_DIR"

# Download sing-box
echo "[DeckBox] Downloading sing-box v${SINGBOX_VERSION}..."
curl -fL --progress-bar -o "${TMP_DIR}/sing-box.tar.gz" "$SINGBOX_URL" || { echo "[DeckBox] ERROR: sing-box download failed."; exit 1; }

echo "[DeckBox] Extracting sing-box..."
mkdir -p "${TMP_DIR}/DeckBox/bin"
tar xzf "${TMP_DIR}/sing-box.tar.gz" -C "${TMP_DIR}/DeckBox/bin" --strip-components=1 "sing-box-${SINGBOX_VERSION}-linux-amd64/sing-box"
chmod +x "${TMP_DIR}/DeckBox/bin/sing-box"

# Verify
"${TMP_DIR}/DeckBox/bin/sing-box" version && echo "[DeckBox] sing-box OK" || { echo "[DeckBox] ERROR: sing-box binary broken."; exit 1; }

# Install plugin
echo "[DeckBox] Installing to ${PLUGIN_DIR}/DeckBox ..."
sudo rm -rf "${PLUGIN_DIR}/DeckBox"
sudo mkdir -p "$PLUGIN_DIR"
sudo mv "${TMP_DIR}/DeckBox" "${PLUGIN_DIR}/DeckBox"
sudo chmod -R 755 "${PLUGIN_DIR}/DeckBox"

# Create settings dir (writable by plugin)
mkdir -p "$SETTINGS_DIR"

# ---- TUN mode setup ----
SINGBOX_BIN="${PLUGIN_DIR}/DeckBox/bin/sing-box"
CONFIG_PATH="${SETTINGS_DIR}/sing-box-config.json"
LOG_PATH="${SETTINGS_DIR}/sing-box.log"

# Load TUN kernel module
echo "[DeckBox] Loading TUN kernel module..."
sudo modprobe tun 2>/dev/null || true

# Create systemd service for TUN mode
echo "[DeckBox] Creating systemd service for TUN mode..."
sudo tee /etc/systemd/system/deckbox-tun.service > /dev/null <<UNIT
[Unit]
Description=DeckBox sing-box TUN proxy
After=network.target

[Service]
Type=simple
User=root
ExecStartPre=/sbin/modprobe tun
ExecStart=${SINGBOX_BIN} run -c ${CONFIG_PATH}
StandardOutput=append:${LOG_PATH}
StandardError=append:${LOG_PATH}
Restart=no
KillMode=process
TimeoutStopSec=5

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload

# Allow deck user to start/stop the service without password and without TTY
echo "[DeckBox] Configuring permissions..."
SYSTEMCTL_PATH="$(which systemctl)"
echo "[DeckBox] systemctl path: ${SYSTEMCTL_PATH}"
sudo tee /etc/sudoers.d/deckbox > /dev/null <<SUDOERS
Defaults:deck !requiretty
deck ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} start deckbox-tun.service
deck ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} stop deckbox-tun.service
deck ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} restart deckbox-tun.service
deck ALL=(root) NOPASSWD: ${SYSTEMCTL_PATH} is-active deckbox-tun.service
deck ALL=(root) NOPASSWD: /usr/bin/systemctl start deckbox-tun.service
deck ALL=(root) NOPASSWD: /usr/bin/systemctl stop deckbox-tun.service
deck ALL=(root) NOPASSWD: /usr/bin/systemctl restart deckbox-tun.service
deck ALL=(root) NOPASSWD: /usr/bin/systemctl is-active deckbox-tun.service
SUDOERS
sudo chmod 440 /etc/sudoers.d/deckbox

# Validate sudoers
sudo visudo -c -f /etc/sudoers.d/deckbox && echo "[DeckBox] sudoers OK" || { echo "[DeckBox] WARNING: sudoers validation failed"; }

rm -rf "$TMP_DIR"

# Restart Decky
echo "[DeckBox] Restarting Decky Loader..."
sudo systemctl restart plugin_loader.service 2>/dev/null || true

echo ""
echo "[DeckBox] All done! sing-box v${SINGBOX_VERSION} included."
echo "[DeckBox] TUN mode is fully configured."
echo "[DeckBox] Open Quick Access Menu > Decky > DeckBox"
echo "[DeckBox] Paste your VLESS key and hit Connect."
