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

### Quick install (recommended)

Open **Konsole** in Desktop Mode and run:

```bash
curl -L https://github.com/user/DeckBox/releases/latest/download/install.sh | sh
```

This downloads the plugin, extracts it to the correct folder, and restarts Decky automatically.

### Install via Decky UI

> **Note:** Decky's "Install from URL" may hang on "Incrementing download count" for third-party
> plugins not listed in the official store. This is a [known Decky issue](https://github.com/SteamDeckHomebrew/decky-loader/issues/608).
> If it hangs for more than 30 seconds, use the quick install method above instead.

1. Quick Access Menu > Decky > Settings (gear icon) > Developer
2. Paste the release ZIP URL into "Install plugin from URL":

   ```
   https://github.com/D3FVLT/DeckBox/releases/latest/download/DeckBox.zip
   ```

3. Wait for it to finish, then restart Decky if needed

### Install manually

1. Download `DeckBox.zip` from [Releases](https://github.com/user/DeckBox/releases)
2. Extract to `~/homebrew/plugins/` so the folder structure is `~/homebrew/plugins/DeckBox/`
3. Restart Decky: `sudo systemctl restart plugin_loader.service`

### Build from source

```bash
pnpm i
pnpm run build
```

Then copy `dist/`, `main.py`, `plugin.json`, `package.json` to `~/homebrew/plugins/DeckBox/` on your Steam Deck.

## Usage

1. **Install sing-box** — press the "Install sing-box" button in the Engine section (first time only)
2. **Add a server** — paste a VLESS link into the "Add Server" field:

   ```
   vless://uuid@host:port?encryption=none&flow=xtls-rprx-vision&security=reality&sni=...#name
   ```

3. **Select the active profile** from the dropdown
4. **Press Connect** — sing-box starts with the selected server
5. **TUN Mode** — flip the toggle to route all traffic through the proxy

### Proxy mode (default)

Starts a SOCKS5/HTTP proxy on `127.0.0.1:2080`. Apps that support proxy settings can use it directly.

### TUN mode

Creates a virtual network interface and redirects all system traffic through the proxy. Works transparently for all apps without any per-app configuration.

## Creating a release ZIP

```bash
pnpm i && pnpm run build
mkdir -p /tmp/DeckBox
cp -r dist main.py plugin.json package.json /tmp/DeckBox/
cd /tmp && zip -r DeckBox.zip DeckBox/
```

Upload `DeckBox.zip` to a GitHub Release. The filename **must** be `DeckBox.zip` (matching the `name` in `plugin.json`).

## Architecture

```
DeckBox/
├── main.py              # Python backend — VLESS URI parsing, sing-box management
├── src/index.tsx         # React frontend — Gaming Mode UI
├── plugin.json           # DeckyLoader metadata
├── package.json
├── install.sh            # One-line installer for Steam Deck
├── backend/
│   └── install_singbox.sh
└── bin/                  # sing-box binary (auto-downloaded at runtime)
```

## License

BSD-3-Clause
