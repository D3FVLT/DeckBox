import {
  ButtonItem,
  PanelSection,
  PanelSectionRow,
  TextField,
  ToggleField,
  DropdownItem,
  Focusable,
  DialogButton,
  ModalRoot,
  staticClasses,
  showModal,
} from "@decky/ui";
import {
  callable,
  definePlugin,
  toaster,
} from "@decky/api";
import { useEffect, useState, FC } from "react";
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
const getLogs = callable<[lines: number], { logs: string }>("get_logs");
const setSudoPassword = callable<[password: string], { ok?: boolean; error?: string }>("set_sudo_password");
const getSudoStatus = callable<[], { has_password: boolean; valid?: boolean }>("get_sudo_status");

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

const AddServerModal: FC<{ closeModal?: () => void; onAdd: (uri: string) => void }> = ({ closeModal, onAdd }) => {
  const [uri, setUri] = useState("");

  return (
    <ModalRoot closeModal={closeModal}>
      <div style={{ padding: "16px", minWidth: 400 }}>
        <h3 style={{ marginBottom: 16 }}>Add VLESS Server</h3>
        <TextField
          label="VLESS Link"
          description="vless://..."
          value={uri}
          onChange={(e) => setUri(e.target.value)}
          focusOnMount={true}
          bShowClearAction={true}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <DialogButton onClick={closeModal} style={{ minWidth: 100 }}>
            Cancel
          </DialogButton>
          <DialogButton
            onClick={() => {
              if (uri.trim()) {
                onAdd(uri);
                closeModal?.();
              }
            }}
            disabled={!uri.trim()}
            style={{ minWidth: 100 }}
          >
            Add
          </DialogButton>
        </div>
      </div>
    </ModalRoot>
  );
};

const LogsModal: FC<{ closeModal?: () => void }> = ({ closeModal }) => {
  const [logs, setLogs] = useState("Loading...");

  const fetchLogs = async () => {
    const result = await getLogs(80);
    setLogs(result.logs);
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ModalRoot closeModal={closeModal}>
      <div style={{ padding: "16px", minWidth: 500, maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>sing-box Logs</h3>
          <DialogButton onClick={fetchLogs} style={{ minWidth: "auto", padding: "4px 12px", fontSize: 12 }}>
            Refresh
          </DialogButton>
        </div>
        <pre
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "#1a1a2e",
            color: "#c8c8c8",
            padding: 12,
            borderRadius: 6,
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            maxHeight: "55vh",
            margin: 0,
          }}
        >
          {logs}
        </pre>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <DialogButton onClick={closeModal} style={{ minWidth: 100 }}>
            Close
          </DialogButton>
        </div>
      </div>
    </ModalRoot>
  );
};

const PasswordModal: FC<{ closeModal?: () => void; onSuccess: () => void }> = ({ closeModal, onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async () => {
    if (!password) return;
    setChecking(true);
    setError("");
    const result = await setSudoPassword(password);
    setChecking(false);
    if (result.error) {
      setError(result.error);
    } else {
      onSuccess();
      closeModal?.();
    }
  };

  return (
    <ModalRoot closeModal={closeModal}>
      <div style={{ padding: "16px", minWidth: 400 }}>
        <h3 style={{ marginBottom: 8 }}>Sudo Password</h3>
        <p style={{ fontSize: 12, color: "#aaa", marginBottom: 12 }}>
          TUN mode needs root access. Enter your Steam Deck password (set via passwd in Konsole).
          Password is stored in memory only — never saved to disk.
        </p>
        <TextField
          label="Password"
          value={password}
          bIsPassword={true}
          onChange={(e) => setPassword(e.target.value)}
          focusOnMount={true}
        />
        {error && (
          <p style={{ color: "#f44336", fontSize: 12, marginTop: 4 }}>{error}</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <DialogButton onClick={closeModal} style={{ minWidth: 100 }}>
            Cancel
          </DialogButton>
          <DialogButton
            onClick={handleSubmit}
            disabled={!password || checking}
            style={{ minWidth: 100 }}
          >
            {checking ? "Checking..." : "OK"}
          </DialogButton>
        </div>
      </div>
    </ModalRoot>
  );
};

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
  const [binaryInfo, setBinaryInfo] = useState<{ exists: boolean; version: string }>({
    exists: false,
    version: "",
  });
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [sudoReady, setSudoReady] = useState(false);

  const refresh = async () => {
    const [p, s, st, b, sudo] = await Promise.all([
      getProfiles(),
      getSettings(),
      getStatus(),
      checkBinary(),
      getSudoStatus(),
    ]);
    setProfiles(p);
    setSettingsState(s);
    setStatus(st);
    setBinaryInfo(b);
    setSudoReady(sudo.has_password && sudo.valid === true);
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(async () => {
      const st = await getStatus();
      setStatus(st);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAddProfile = async (uri: string) => {
    if (!uri.trim()) return;
    setLoading(true);
    const result = await addProfile(uri.trim());
    if (result.error) {
      toaster.toast({ title: "DeckBox", body: `Error: ${result.error}` });
    } else {
      toaster.toast({ title: "DeckBox", body: "Profile added" });
    }
    await refresh();
    setLoading(false);
  };

  const openAddServerModal = () => {
    showModal(
      <AddServerModal onAdd={handleAddProfile} />,
    );
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
        toaster.toast({ title: "DeckBox Error", body: `${result.error}\nCheck View Logs for details.` });
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
        {settings.tun_mode && (
          <>
            <PanelSectionRow>
              <Focusable style={{ padding: "4px 0", fontSize: 13 }}>
                {sudoReady
                  ? "🔑 Password set"
                  : "⚠️ Sudo password required"}
              </Focusable>
            </PanelSectionRow>
            <PanelSectionRow>
              <ButtonItem
                layout="below"
                onClick={() => showModal(
                  <PasswordModal onSuccess={() => {
                    setSudoReady(true);
                    toaster.toast({ title: "DeckBox", body: "Password saved for this session" });
                  }} />
                )}
              >
                {sudoReady ? "Change Password" : "Enter Sudo Password"}
              </ButtonItem>
            </PanelSectionRow>
          </>
        )}
      </PanelSection>

      {/* Add Profile */}
      <PanelSection title="Add Server">
        <PanelSectionRow>
          <ButtonItem layout="below" disabled={loading} onClick={openAddServerModal}>
            Add Server
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
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => showModal(<LogsModal />)}
          >
            View Logs
          </ButtonItem>
        </PanelSectionRow>
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
