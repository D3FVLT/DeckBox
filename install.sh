#!/bin/bash
# DeckBox installer — run this on your Steam Deck in Desktop Mode (Konsole)
# Usage: curl -fL https://github.com/D3FVLT/DeckBox/releases/latest/download/install.sh | bash

set -e

PLUGIN_DIR="${HOME}/homebrew/plugins"
RELEASE_URL="https://github.com/D3FVLT/DeckBox/releases/latest/download/DeckBox.zip"
TMP_DIR="/tmp/deckbox_install"
TMP_ZIP="${TMP_DIR}/DeckBox.zip"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

echo "[DeckBox] Downloading plugin..."
curl -fL -o "$TMP_ZIP" "$RELEASE_URL" || { echo "[DeckBox] ERROR: Download failed."; exit 1; }

echo "[DeckBox] Extracting..."
unzip -o "$TMP_ZIP" -d "$TMP_DIR"

echo "[DeckBox] Installing to ${PLUGIN_DIR}/DeckBox ..."
sudo rm -rf "${PLUGIN_DIR}/DeckBox"
sudo mkdir -p "$PLUGIN_DIR"
sudo mv "${TMP_DIR}/DeckBox" "${PLUGIN_DIR}/DeckBox"
sudo chmod -R 755 "${PLUGIN_DIR}/DeckBox"

rm -rf "$TMP_DIR"

echo "[DeckBox] Restarting Decky Loader..."
sudo systemctl restart plugin_loader.service 2>/dev/null || true

echo "[DeckBox] Done! Open Quick Access Menu > Decky to find DeckBox."
echo "[DeckBox] Don't forget to press 'Install sing-box' inside the plugin."
