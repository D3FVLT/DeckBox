# DeckBox

A VLESS/Reality proxy client for Steam Deck — DeckyLoader plugin.

Think nekoray / Throne, but for Gaming Mode. Add your VLESS keys, connect with one click.

## Features

- **VLESS + Reality** — full support for VLESS URIs with Reality, XTLS-Vision, uTLS fingerprinting
- **Local SOCKS/HTTP proxy** — runs sing-box on a configurable port (default 2080)
- **TUN Mode** — routes all system traffic through the proxy
- **Multiple profiles** — store several servers, switch between them instantly
- **One-click engine install** — sing-box binary is downloaded directly from the plugin UI

## Installation

### Prerequisites

- Steam Deck with [DeckyLoader](https://github.com/SteamDeckHomebrew/decky-loader) installed
- Internet connection (required to download sing-box on first use)

### Install via URL (recommended)

1. In Gaming Mode, open the **Quick Access Menu** > **Decky** > **Settings** (gear icon)
2. Go to **Developer** section
3. Paste the release ZIP URL into **Install plugin from URL**:

   ```
   https://github.com/D3FVLT/DeckBox/releases/latest/download/DeckBox.zip
   ```

4. Restart Decky if the plugin doesn't appear immediately
5. Open DeckBox and press **Install sing-box** to download the engine

### Install manually

1. Download `DeckBox.zip` from [Releases](https://github.com/D3FVLT/DeckBox/releases)
2. Extract to `~/homebrew/plugins/` so the folder structure is `~/homebrew/plugins/DeckBox/`
3. Restart DeckyLoader
4. Open DeckBox and press **Install sing-box**

### Build from source

```bash
pnpm i
pnpm run build
```

Then copy the following files to `~/homebrew/plugins/DeckBox/` on your Steam Deck:

- `dist/` (compiled frontend)
- `main.py`
- `plugin.json`
- `package.json`

## Usage

1. **Add a server** — paste a VLESS link into the "Add Server" field:

   ```
   vless://uuid@host:port?encryption=none&flow=xtls-rprx-vision&security=reality&sni=...#name
   ```

2. **Select the active profile** from the dropdown
3. **Press Connect** — sing-box starts with the selected server
4. **TUN Mode** — flip the toggle to route all traffic through the proxy

### Proxy mode (default)

Starts a SOCKS5/HTTP proxy on `127.0.0.1:2080`. Apps that support proxy settings can use it directly.

### TUN mode

Creates a virtual network interface and redirects all system traffic through the proxy. Works transparently for all apps without any per-app configuration.

## Creating a release ZIP

To package the plugin for distribution:

```bash
pnpm i && pnpm run build
mkdir -p /tmp/DeckBox
cp -r dist main.py plugin.json package.json /tmp/DeckBox/
cd /tmp && zip -r DeckBox.zip DeckBox/
```

Upload `DeckBox.zip` to a GitHub Release. The filename **must** be `DeckBox.zip` (matching the name in `plugin.json`) for Decky's "Install from URL" to work correctly.

## Architecture

```
DeckBox/
├── main.py              # Python backend — VLESS URI parsing, sing-box management
├── src/index.tsx         # React frontend — Gaming Mode UI
├── plugin.json           # DeckyLoader metadata
├── package.json
├── backend/
│   └── install_singbox.sh
└── bin/                  # sing-box binary (auto-downloaded at runtime)
```

## License

BSD-3-Clause
