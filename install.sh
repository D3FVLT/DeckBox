#!/bin/bash
# DeckBox installer — run this on your Steam Deck in Desktop Mode (Konsole)
# Usage: curl -fL https://github.com/D3FVLT/DeckBox/releases/latest/download/install.sh | bash

set -e

PLUGIN_DIR="${HOME}/homebrew/plugins"
RELEASE_URL="https://github.com/D3FVLT/DeckBox/releases/latest/download/DeckBox.zip"
SINGBOX_VERSION="1.11.0"
SINGBOX_URL="https://github.com/SagerNet/sing-box/releases/download/v${SINGBOX_VERSION}/sing-box-${SINGBOX_VERSION}-linux-amd64.tar.gz"
TMP_DIR="/tmp/deckbox_install"

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
sudo setcap cap_net_admin,cap_net_bind_service,cap_net_raw+ep "${TMP_DIR}/DeckBox/bin/sing-box" 2>/dev/null || true

# Verify
"${TMP_DIR}/DeckBox/bin/sing-box" version && echo "[DeckBox] sing-box OK" || { echo "[DeckBox] ERROR: sing-box binary broken."; exit 1; }

# Install
echo "[DeckBox] Installing to ${PLUGIN_DIR}/DeckBox ..."
sudo rm -rf "${PLUGIN_DIR}/DeckBox"
sudo mkdir -p "$PLUGIN_DIR"
sudo mv "${TMP_DIR}/DeckBox" "${PLUGIN_DIR}/DeckBox"
sudo chmod -R 755 "${PLUGIN_DIR}/DeckBox"

# TUN mode support: load kernel module
echo "[DeckBox] Configuring TUN support..."
sudo modprobe tun 2>/dev/null || true

rm -rf "$TMP_DIR"

# Restart Decky
echo "[DeckBox] Restarting Decky Loader..."
sudo systemctl restart plugin_loader.service 2>/dev/null || true

echo ""
echo "[DeckBox] All done! sing-box v${SINGBOX_VERSION} included."
echo "[DeckBox] Open Quick Access Menu > Decky > DeckBox"
echo "[DeckBox] Paste your VLESS key and hit Connect."
