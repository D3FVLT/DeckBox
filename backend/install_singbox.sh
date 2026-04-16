#!/bin/bash
# Install sing-box binary for DeckBox plugin (Steam Deck / linux-amd64)

set -e

VERSION="1.11.0"
ARCH="amd64"
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="${PLUGIN_DIR}/bin"

mkdir -p "$BIN_DIR"

TARBALL="sing-box-${VERSION}-linux-${ARCH}.tar.gz"
URL="https://github.com/SagerNet/sing-box/releases/download/v${VERSION}/${TARBALL}"

echo "[DeckBox] Downloading sing-box v${VERSION}..."
curl -L -o "${BIN_DIR}/${TARBALL}" "$URL"

echo "[DeckBox] Extracting..."
tar xzf "${BIN_DIR}/${TARBALL}" -C "$BIN_DIR" --strip-components=1 "sing-box-${VERSION}-linux-${ARCH}/sing-box"

chmod +x "${BIN_DIR}/sing-box"
rm -f "${BIN_DIR}/${TARBALL}"

echo "[DeckBox] sing-box installed:"
"${BIN_DIR}/sing-box" version
