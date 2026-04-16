import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  ToggleField,
  DropdownItem,
  Focusable,
  DialogButton,
  staticClasses,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
} from "@decky/api";
import { useEffect, useState } from "react";
import { VscDebugDisconnect } from "react-icons/vsc";

interface Profile {
  name: string;
  address: string;
  port: number;
  uuid: string;
  uri: string;
}

interface Settings {
  listen_port: number;
  tun_mode: boolean;
  active_profile: number;
}

interface Status {
  running: boolean;
  tun_mode: boolean;
  listen_port: number;
  active_profile: number;
}

const getProfiles = callable<[], Profile[]>("get_profiles");
const addProfile = callable<[uri: string], { ok?: boolean; error?: string; index?: number }>("add_profile");
const removeProfile = callable<[index: number], { ok?: boolean; error?: string }>("remove_profile");
const getSettings = callable<[], Settings>("get_settings");
const setSettings = callable<[listen_port: number, tun_mode: boolean, active_profile: number], { ok?: boolean }>("set_settings");
const getStatus = callable<[], Status>("get_status");
const startProxy = callable<[], { ok?: boolean; error?: string; pid?: number }>("start_proxy");
const stopProxy = callable<[], { ok?: boolean }>("stop_proxy");
const checkBinary = callable<[], { exists: boolean; version: string }>("check_binary");
const installSingbox = callable<[], { exists?: boolean; version?: string; error?: string }>("install_singbox");

function StatusBadge({ running }: { running: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: running ? "#4caf50" : "#f44336",
        marginRight: 8,
        verticalAlign: "middle",
      }}
    />
  );
}

function Content() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettingsState] = useState<Settings>({
    listen_port: 2080,
    tun_mode: false,
    active_profile: -1,
  });
  const [status, setStatus] = useState<Status>({
    running: false,
    tun_mode: false,
    listen_port: 2080,
    active_profile: -1,
  });
  const [newUri, setNewUri] = useState("");
  const [binaryInfo, setBinaryInfo] = useState<{ exists: boolean; version: string }>({
    exists: false,
    version: "",
  });
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);

  const refresh = async () => {
    const [p, s, st, b] = await Promise.all([
      getProfiles(),
      getSettings(),
      getStatus(),
      checkBinary(),
    ]);
    setProfiles(p);
    setSettingsState(s);
    setStatus(st);
    setBinaryInfo(b);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(async () => {
      const st = await getStatus();
      setStatus(st);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddProfile = async () => {
    if (!newUri.trim()) return;
    setLoading(true);
    const result = await addProfile(newUri.trim());
    if (result.error) {
      toaster.toast({ title: "DeckBox", body: `Error: ${result.error}` });
    } else {
      toaster.toast({ title: "DeckBox", body: "Profile added" });
      setNewUri("");
    }
    await refresh();
    setLoading(false);
  };

  const handleRemove = async (index: number) => {
    setLoading(true);
    await removeProfile(index);
    await refresh();
    setLoading(false);
  };

  const handleToggleProxy = async () => {
    setLoading(true);
    if (status.running) {
      await stopProxy();
      toaster.toast({ title: "DeckBox", body: "Proxy stopped" });
    } else {
      const result = await startProxy();
      if (result.error) {
        toaster.toast({ title: "DeckBox", body: `Error: ${result.error}` });
      } else {
        toaster.toast({ title: "DeckBox", body: "Proxy started" });
      }
    }
    await refresh();
    setLoading(false);
  };

  const handleSetActiveProfile = async (index: number) => {
    const newSettings = { ...settings, active_profile: index };
    await setSettings(newSettings.listen_port, newSettings.tun_mode, newSettings.active_profile);
    setSettingsState(newSettings);
    if (status.running) {
      setLoading(true);
      await stopProxy();
      const result = await startProxy();
      if (result.error) {
        toaster.toast({ title: "DeckBox", body: `Restart error: ${result.error}` });
      }
      await refresh();
      setLoading(false);
    }
  };

  const handleToggleTun = async (checked: boolean) => {
    const newSettings = { ...settings, tun_mode: checked };
    await setSettings(newSettings.listen_port, newSettings.tun_mode, newSettings.active_profile);
    setSettingsState(newSettings);
    if (status.running) {
      setLoading(true);
      await stopProxy();
      const result = await startProxy();
      if (result.error) {
        toaster.toast({ title: "DeckBox", body: `Restart error: ${result.error}` });
      }
      await refresh();
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    toaster.toast({ title: "DeckBox", body: "Downloading sing-box..." });
    const result = await installSingbox();
    if (result.error) {
      toaster.toast({ title: "DeckBox", body: `Install error: ${result.error}` });
    } else {
      toaster.toast({ title: "DeckBox", body: `sing-box ${result.version} installed` });
    }
    await refresh();
    setInstalling(false);
  };

  const profileDropdownOptions = profiles.map((p, i) => ({
    data: i,
    label: p.name || `${p.address}:${p.port}`,
  }));

  return (
    <>
      {/* Status */}
      <PanelSection title="Status">
        <PanelSectionRow>
          <Focusable style={{ display: "flex", alignItems: "center", padding: "8px 0" }}>
            <StatusBadge running={status.running} />
            <span style={{ flex: 1 }}>
              {status.running
                ? settings.tun_mode
                  ? "Connected (TUN)"
                  : `Connected (port ${status.listen_port})`
                : "Disconnected"}
            </span>
          </Focusable>
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            disabled={loading || settings.active_profile < 0 || !binaryInfo.exists}
            onClick={handleToggleProxy}
          >
            {status.running ? "Disconnect" : "Connect"}
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* Active Profile Selection */}
      {profiles.length > 0 && (
        <PanelSection title="Active Profile">
          <PanelSectionRow>
            <DropdownItem
              label="Server"
              rgOptions={profileDropdownOptions}
              selectedOption={settings.active_profile >= 0 ? settings.active_profile : undefined}
              onChange={(option) => handleSetActiveProfile(option.data)}
            />
          </PanelSectionRow>
        </PanelSection>
      )}

      {/* Settings */}
      <PanelSection title="Settings">
        <PanelSectionRow>
          <ToggleField
            label="TUN Mode"
            description="Route all traffic through proxy"
            checked={settings.tun_mode}
            onChange={handleToggleTun}
          />
        </PanelSectionRow>
      </PanelSection>

      {/* Add Profile */}
      <PanelSection title="Add Server">
        <PanelSectionRow>
          <TextField
            label="VLESS Link"
            value={newUri}
            onChange={(e) => setNewUri(e.target.value)}
          />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={loading || !newUri.trim()} onClick={handleAddProfile}>
            Add
          </ButtonItem>
        </PanelSectionRow>
      </PanelSection>

      {/* Profile List */}
      {profiles.length > 0 && (
        <PanelSection title="Servers">
          {profiles.map((profile, index) => (
            <PanelSectionRow key={index}>
              <Focusable
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  width: "100%",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    color: settings.active_profile === index ? "#59bf40" : undefined,
                  }}
                >
                  {profile.name || `${profile.address}:${profile.port}`}
                </span>
                <DialogButton
                  style={{
                    minWidth: "auto",
                    width: 32,
                    height: 32,
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onClick={() => handleRemove(index)}
                >
                  ✕
                </DialogButton>
              </Focusable>
            </PanelSectionRow>
          ))}
        </PanelSection>
      )}

      {/* sing-box binary */}
      <PanelSection title="Engine">
        <PanelSectionRow>
          <Focusable style={{ padding: "4px 0", fontSize: 13 }}>
            {binaryInfo.exists
              ? `sing-box: ${binaryInfo.version || "installed"}`
              : "sing-box: not installed"}
          </Focusable>
        </PanelSectionRow>
        {!binaryInfo.exists && (
          <PanelSectionRow>
            <ButtonItem layout="below" disabled={installing} onClick={handleInstall}>
              {installing ? "Installing..." : "Install sing-box"}
            </ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
}

export default definePlugin(() => {
  return {
    name: "DeckBox",
    titleView: (
      <div className={staticClasses.Title}>DeckBox</div>
    ),
    content: <Content />,
    icon: <VscDebugDisconnect />,
    onDismount() {},
  };
});
