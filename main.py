import os
import json
import asyncio
import subprocess
import signal
from urllib.parse import urlparse, parse_qs, unquote

import decky


SINGBOX_BIN = os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "sing-box")
CONFIG_DIR = decky.DECKY_PLUGIN_SETTINGS_DIR
CONFIG_PATH = os.path.join(CONFIG_DIR, "sing-box-config.json")
PROFILES_PATH = os.path.join(CONFIG_DIR, "profiles.json")
LOG_PATH = os.path.join(CONFIG_DIR, "sing-box.log")
SYSTEMD_UNIT = "deckbox-tun.service"


def parse_vless_uri(uri: str) -> dict:
    """Parse a vless:// URI into a structured dict."""
    uri = uri.strip()
    if not uri.startswith("vless://"):
        raise ValueError("Not a valid VLESS URI")

    without_scheme = uri[len("vless://"):]

    fragment = ""
    if "#" in without_scheme:
        without_scheme, fragment = without_scheme.rsplit("#", 1)
        fragment = unquote(fragment)

    user_host, _, query_string = without_scheme.partition("?")
    uuid_part, _, addr_port = user_host.partition("@")

    if ":" in addr_port:
        address, port_str = addr_port.rsplit(":", 1)
        port = int(port_str)
    else:
        address = addr_port
        port = 443

    params = parse_qs(query_string)

    def p(key: str, default: str = "") -> str:
        return params.get(key, [default])[0]

    return {
        "name": fragment or f"{address}:{port}",
        "uuid": uuid_part,
        "address": address,
        "port": port,
        "encryption": p("encryption", "none"),
        "flow": p("flow"),
        "security": p("security"),
        "sni": p("sni"),
        "fingerprint": p("fp", "chrome"),
        "public_key": p("pbk"),
        "short_id": p("sid"),
        "packet_encoding": p("packetEncoding", "xudp"),
        "network": p("type", "tcp"),
        "path": p("path"),
        "host": p("host"),
    }


def build_singbox_config(profile: dict, listen_port: int = 2080, tun_mode: bool = False) -> dict:
    """Build a sing-box JSON config from a parsed VLESS profile."""
    inbounds = []

    if tun_mode:
        inbounds.append({
            "type": "tun",
            "tag": "tun-in",
            "address": ["172.19.0.1/30"],
            "auto_route": True,
            "strict_route": True,
            "stack": "system",
            "sniff": True,
        })
    else:
        inbounds.append({
            "type": "mixed",
            "tag": "mixed-in",
            "listen": "127.0.0.1",
            "listen_port": listen_port,
            "sniff": True,
        })

    outbound: dict = {
        "type": "vless",
        "tag": "proxy",
        "server": profile["address"],
        "server_port": profile["port"],
        "uuid": profile["uuid"],
        "packet_encoding": profile.get("packet_encoding", "xudp"),
    }

    if profile.get("flow"):
        outbound["flow"] = profile["flow"]

    tls_config: dict = {"enabled": True}

    if profile.get("sni"):
        tls_config["server_name"] = profile["sni"]

    if profile.get("fingerprint"):
        tls_config["utls"] = {
            "enabled": True,
            "fingerprint": profile["fingerprint"],
        }

    security = profile.get("security", "")
    if security == "reality":
        tls_config["reality"] = {
            "enabled": True,
            "public_key": profile.get("public_key", ""),
            "short_id": profile.get("short_id", ""),
        }
    elif security == "tls":
        pass
    elif security in ("none", ""):
        tls_config["enabled"] = False

    if tls_config.get("enabled", False):
        outbound["tls"] = tls_config

    network = profile.get("network", "tcp")
    if network == "ws":
        transport = {"type": "ws"}
        if profile.get("path"):
            transport["path"] = profile["path"]
        if profile.get("host"):
            transport["headers"] = {"Host": profile["host"]}
        outbound["transport"] = transport
    elif network == "grpc":
        outbound["transport"] = {"type": "grpc", "service_name": profile.get("path", "")}

    outbounds = [
        outbound,
        {"type": "direct", "tag": "direct"},
        {"type": "dns", "tag": "dns-out"},
    ]

    dns_config = {
        "servers": [
            {"tag": "proxy-dns", "address": "https://1.1.1.1/dns-query", "detour": "proxy"},
            {"tag": "direct-dns", "address": "https://77.88.8.8/dns-query", "detour": "direct"},
        ],
        "rules": [{"outbound": "any", "server": "direct-dns"}],
        "strategy": "ipv4_only",
    }

    route_config: dict = {
        "auto_detect_interface": True,
        "rules": [
            {"protocol": "dns", "outbound": "dns-out"},
        ],
        "final": "proxy",
    }

    config = {
        "log": {"level": "info", "timestamp": True},
        "dns": dns_config,
        "inbounds": inbounds,
        "outbounds": outbounds,
        "route": route_config,
    }

    return config


def load_profiles() -> list:
    if os.path.exists(PROFILES_PATH):
        with open(PROFILES_PATH, "r") as f:
            return json.load(f)
    return []


def save_profiles(profiles: list):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(PROFILES_PATH, "w") as f:
        json.dump(profiles, f, indent=2)


def load_settings() -> dict:
    settings_path = os.path.join(CONFIG_DIR, "settings.json")
    if os.path.exists(settings_path):
        with open(settings_path, "r") as f:
            return json.load(f)
    return {"listen_port": 2080, "tun_mode": False, "active_profile": -1}


def save_settings(settings: dict):
    os.makedirs(CONFIG_DIR, exist_ok=True)
    settings_path = os.path.join(CONFIG_DIR, "settings.json")
    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2)


class Plugin:
    singbox_process: subprocess.Popen | None = None

    async def get_profiles(self) -> list:
        return load_profiles()

    async def add_profile(self, uri: str) -> dict:
        try:
            profile = parse_vless_uri(uri)
        except Exception as e:
            return {"error": str(e)}

        profiles = load_profiles()
        profile["uri"] = uri
        profiles.append(profile)
        save_profiles(profiles)
        return {"ok": True, "profile": profile, "index": len(profiles) - 1}

    async def remove_profile(self, index: int) -> dict:
        profiles = load_profiles()
        if 0 <= index < len(profiles):
            removed = profiles.pop(index)
            save_profiles(profiles)
            settings = load_settings()
            if settings["active_profile"] == index:
                settings["active_profile"] = -1
                save_settings(settings)
            elif settings["active_profile"] > index:
                settings["active_profile"] -= 1
                save_settings(settings)
            return {"ok": True, "removed": removed["name"]}
        return {"error": "Invalid index"}

    async def get_settings(self) -> dict:
        return load_settings()

    async def set_settings(self, listen_port: int, tun_mode: bool, active_profile: int) -> dict:
        settings = {
            "listen_port": listen_port,
            "tun_mode": tun_mode,
            "active_profile": active_profile,
        }
        save_settings(settings)
        return {"ok": True}

    async def get_status(self) -> dict:
        proc_running = self.singbox_process is not None and self.singbox_process.poll() is None
        svc_running = self._is_service_active()
        settings = load_settings()
        return {
            "running": proc_running or svc_running,
            "tun_mode": settings["tun_mode"],
            "listen_port": settings["listen_port"],
            "active_profile": settings["active_profile"],
        }

    def _is_service_active(self) -> bool:
        try:
            r = subprocess.run(
                ["sudo", "-n", "systemctl", "is-active", SYSTEMD_UNIT],
                capture_output=True, text=True, timeout=5,
            )
            return r.stdout.strip() == "active"
        except Exception:
            return False

    async def start_proxy(self) -> dict:
        settings = load_settings()
        tun = settings["tun_mode"]

        if tun and self._is_service_active():
            return {"error": "Proxy is already running"}
        if not tun and self.singbox_process and self.singbox_process.poll() is None:
            return {"error": "Proxy is already running"}

        profiles = load_profiles()
        idx = settings["active_profile"]

        if idx < 0 or idx >= len(profiles):
            return {"error": "No active profile selected"}

        profile = profiles[idx]
        config = build_singbox_config(
            profile,
            listen_port=settings["listen_port"],
            tun_mode=tun,
        )

        os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(CONFIG_PATH, "w") as f:
            json.dump(config, f, indent=2)

        if not os.path.isfile(SINGBOX_BIN):
            return {"error": "sing-box binary not found. Run install script first."}

        try:
            if tun:
                with open(LOG_PATH, "w") as f:
                    f.write("")
                r = subprocess.run(
                    ["sudo", "-n", "systemctl", "start", SYSTEMD_UNIT],
                    capture_output=True, text=True, timeout=10,
                )
                if r.returncode != 0:
                    return {"error": f"Failed to start service: {r.stderr[:300]}"}
                await asyncio.sleep(1)
                if not self._is_service_active():
                    with open(LOG_PATH, "r") as f:
                        log = f.read()
                    return {"error": f"sing-box exited: {log[:500]}"}
                decky.logger.info("sing-box started via systemd (TUN)")
                return {"ok": True}
            else:
                cmd = [SINGBOX_BIN, "run", "-c", CONFIG_PATH]
                self.log_file = open(LOG_PATH, "w")
                self.singbox_process = subprocess.Popen(
                    cmd,
                    stdout=self.log_file,
                    stderr=self.log_file,
                )
                await asyncio.sleep(1)
                if self.singbox_process.poll() is not None:
                    self.log_file.close()
                    with open(LOG_PATH, "r") as f:
                        log = f.read()
                    return {"error": f"sing-box exited immediately: {log[:500]}"}
                decky.logger.info(f"sing-box started, pid={self.singbox_process.pid}")
                return {"ok": True, "pid": self.singbox_process.pid}
        except Exception as e:
            return {"error": str(e)}

    async def stop_proxy(self) -> dict:
        stopped_service = False
        if self._is_service_active():
            subprocess.run(["sudo", "-n", "systemctl", "stop", SYSTEMD_UNIT], capture_output=True, timeout=10)
            stopped_service = True
            decky.logger.info("sing-box systemd service stopped")

        if self.singbox_process and self.singbox_process.poll() is None:
            try:
                self.singbox_process.terminate()
                self.singbox_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.singbox_process.kill()
                try:
                    self.singbox_process.wait(timeout=3)
                except Exception:
                    pass
            decky.logger.info("sing-box process stopped")

        self.singbox_process = None
        if hasattr(self, "log_file") and self.log_file and not self.log_file.closed:
            self.log_file.close()

        subprocess.run(["pkill", "-f", "sing-box run"], capture_output=True, timeout=3)

        return {"ok": True, "was_running": stopped_service or True}

    async def restart_proxy(self) -> dict:
        await self.stop_proxy()
        return await self.start_proxy()

    async def get_logs(self, lines: int = 50) -> dict:
        try:
            if not os.path.exists(LOG_PATH):
                return {"logs": "No logs yet. Connect to a server first."}
            max_read = 256 * 1024
            size = os.path.getsize(LOG_PATH)
            with open(LOG_PATH, "r") as f:
                if size > max_read:
                    f.seek(size - max_read)
                    f.readline()
                all_lines = f.readlines()
            tail = all_lines[-lines:]
            return {"logs": "".join(tail)}
        except Exception as e:
            return {"logs": f"Error reading logs: {e}"}

    async def setup_tun_permissions(self) -> dict:
        """Check if TUN mode is properly set up by install.sh."""
        try:
            tun_exists = os.path.exists("/dev/net/tun")
            svc_exists = os.path.isfile("/etc/systemd/system/deckbox-tun.service")
            sudoers_exists = os.path.isfile("/etc/sudoers.d/deckbox")
            if not svc_exists or not sudoers_exists:
                return {"error": "TUN not configured. Re-run install.sh in Konsole."}
            if not tun_exists:
                return {"error": "TUN device missing. Run: sudo modprobe tun"}
            return {"ok": True}
        except Exception as e:
            return {"error": str(e)}

    async def check_binary(self) -> dict:
        exists = os.path.isfile(SINGBOX_BIN)
        version = ""
        if exists:
            try:
                result = subprocess.run(
                    [SINGBOX_BIN, "version"],
                    capture_output=True, text=True, timeout=5
                )
                version = result.stdout.strip().split("\n")[0] if result.returncode == 0 else ""
            except Exception:
                pass
        return {"exists": exists, "version": version}

    async def install_singbox(self) -> dict:
        """Download and install sing-box binary for linux-amd64 (Steam Deck)."""
        bin_dir = os.path.join(decky.DECKY_PLUGIN_DIR, "bin")
        os.makedirs(bin_dir, exist_ok=True)

        version = "1.11.0"
        url = f"https://github.com/SagerNet/sing-box/releases/download/v{version}/sing-box-{version}-linux-amd64.tar.gz"
        tar_path = os.path.join(bin_dir, "sing-box.tar.gz")

        try:
            proc = await asyncio.create_subprocess_exec(
                "curl", "-fL", "--connect-timeout", "10", "--max-time", "120",
                "-o", tar_path, url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr_data = await proc.communicate()
            if proc.returncode != 0:
                return {"error": f"Download failed: {stderr_data.decode()[:300]}"}

            proc = await asyncio.create_subprocess_exec(
                "tar", "xzf", tar_path, "-C", bin_dir, "--strip-components=1",
                f"sing-box-{version}-linux-amd64/sing-box",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr_data = await proc.communicate()
            if proc.returncode != 0:
                return {"error": f"Extract failed: {stderr_data.decode()[:300]}"}

            os.chmod(SINGBOX_BIN, 0o755)
            if os.path.exists(tar_path):
                os.remove(tar_path)

            return await self.check_binary()
        except Exception as e:
            return {"error": str(e)}

    async def _main(self):
        decky.logger.info("DeckBox plugin loaded")
        os.makedirs(CONFIG_DIR, exist_ok=True)

    async def _unload(self):
        decky.logger.info("DeckBox unloading, stopping proxy...")
        await self.stop_proxy()

    async def _uninstall(self):
        decky.logger.info("DeckBox uninstalling")
        await self.stop_proxy()

    async def _migration(self):
        decky.logger.info("DeckBox migration check")
