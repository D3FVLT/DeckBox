#!/bin/bash
# DeckBox installer — run this on your Steam Deck in Desktop Mode (Konsole)
# Usage: curl -L https://github.com/D3FVLT/DeckBox/releases/latest/download/install.sh | bash

set -e

PLUGIN_DIR="${HOME}/homebrew/plugins"
RELEASE_URL="https://github.com/D3FVLT/DeckBox/releases/latest/download/DeckBox.zip"
TMP_ZIP="/tmp/DeckBox.zip"

echo "[DeckBox] Downloading plugin..."
curl -fL -o "$TMP_ZIP" "$RELEASE_URL" || { echo "[DeckBox] ERROR: Download failed. Check the URL or your internet connection."; exit 1; }

echo "[DeckBox] Installing to ${PLUGIN_DIR}/DeckBox ..."
rm -rf "${PLUGIN_DIR}/DeckBox"
mkdir -p "$PLUGIN_DIR"
unzip -o "$TMP_ZIP" -d "$PLUGIN_DIR"
rm -f "$TMP_ZIP"

echo "[DeckBox] Restarting Decky Loader..."
sudo systemctl restart plugin_loader.service 2>/dev/null || true

echo "[DeckBox] Done! Open Quick Access Menu > Decky to find DeckBox."
echo "[DeckBox] Don't forget to press 'Install sing-box' inside the plugin."
