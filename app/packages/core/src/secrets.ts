import { loadGlobalConfig, saveGlobalConfig, globalConfigPath } from "./config";

// OS keychain identifiers. The "service" namespace lets keytar coexist with
// other apps that use the system keychain.
const SERVICE = process.env["LLM_WIKI_KEYCHAIN_SERVICE"] || "llm-wiki";
const OPENROUTER_ACCOUNT = "openrouter";
const BAILIAN_ACCOUNT = "bailian";

export type ApiKeySource = "keychain" | "config" | "env" | "none";

export type ApiKeyResult = {
  key: string | null;
  source: ApiKeySource;
  /** True when keytar is unusable on this host. Surface in the UI as a warning. */
  keychainAvailable: boolean;
};

// Lazy-import keytar so a load failure (e.g. Linux without libsecret)
// degrades cleanly to file storage instead of crashing the whole app.
type KeytarModule = typeof import("keytar");
let keytarPromise: Promise<KeytarModule | null> | null = null;

async function loadKeytar(): Promise<KeytarModule | null> {
  if (keytarPromise) return keytarPromise;
  keytarPromise = (async () => {
    try {
      const mod = await import("keytar");
      // Round-trip a probe call: native modules can import but throw on use
      // when the OS service isn't running. Findings:
      //   - macOS Keychain: always available
      //   - Windows Credential Manager: always available
      //   - Linux: requires gnome-keyring or KWallet via libsecret
      await mod.findCredentials(SERVICE);
      return mod;
    } catch {
      return null;
    }
  })();
  return keytarPromise;
}

export async function isKeychainAvailable(): Promise<boolean> {
  return (await loadKeytar()) !== null;
}

export async function getApiKey(): Promise<ApiKeyResult> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      const key = await keytar.getPassword(SERVICE, OPENROUTER_ACCOUNT);
      if (key) return { key, source: "keychain", keychainAvailable: true };
    } catch {
      // fall through to config-file lookup
    }
  }
  const cfg = await loadGlobalConfig();
  if (cfg.openrouterKey) {
    return { key: cfg.openrouterKey, source: "config", keychainAvailable: keytar !== null };
  }
  return { key: null, source: "none", keychainAvailable: keytar !== null };
}

export async function setApiKey(key: string): Promise<ApiKeyResult> {
  if (!key.trim()) throw new Error("setApiKey: key must be non-empty");
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, OPENROUTER_ACCOUNT, key);
      // Successful keychain write — purge any stale copy from config.json so
      // the key never lives in two places.
      const cfg = await loadGlobalConfig();
      if (cfg.openrouterKey) {
        const { openrouterKey: _drop, ...rest } = cfg;
        void _drop;
        await saveGlobalConfig({ ...rest, version: 1 });
      }
      return { key, source: "keychain", keychainAvailable: true };
    } catch {
      // fall through to config-file storage
    }
  }
  const cfg = await loadGlobalConfig();
  await saveGlobalConfig({ ...cfg, openrouterKey: key });
  return { key, source: "config", keychainAvailable: keytar !== null };
}

export async function deleteApiKey(): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE, OPENROUTER_ACCOUNT);
    } catch {
      // ignore — the key may not have been set via keychain
    }
  }
  const cfg = await loadGlobalConfig();
  if (cfg.openrouterKey) {
    const { openrouterKey: _drop, ...rest } = cfg;
    void _drop;
    await saveGlobalConfig({ ...rest, version: 1 });
  }
}

export async function getBailianApiKey(): Promise<ApiKeyResult> {
  const cfg = await loadGlobalConfig();
  const keytar = await loadKeytar();
  if (cfg.bailianKeyDisabled) {
    return { key: null, source: "none", keychainAvailable: keytar !== null };
  }
  if (cfg.bailianApiKey) {
    return { key: cfg.bailianApiKey, source: "config", keychainAvailable: keytar !== null };
  }
  if (keytar) {
    try {
      const key = await keytar.getPassword(SERVICE, BAILIAN_ACCOUNT);
      if (key) return { key, source: "keychain", keychainAvailable: true };
    } catch {
      // fall through to the legacy environment variable
    }
  }
  const key = process.env["DASHSCOPE_API_KEY"]?.trim() || null;
  return {
    key,
    source: key ? "env" : "none",
    keychainAvailable: keytar !== null,
  };
}

export async function setBailianApiKey(key: string): Promise<ApiKeyResult> {
  const normalized = key.trim();
  if (!normalized) throw new Error("setBailianApiKey: key must be non-empty");
  const cfg = await loadGlobalConfig();
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE, BAILIAN_ACCOUNT, normalized);
      const { bailianApiKey: _key, bailianKeyDisabled: _disabled, ...rest } = cfg;
      void _key;
      void _disabled;
      await saveGlobalConfig({ ...rest, version: 1 });
      return { key: normalized, source: "keychain", keychainAvailable: true };
    } catch {
      // fall through to the restricted user config file
    }
  }
  const { bailianKeyDisabled: _disabled, ...rest } = cfg;
  void _disabled;
  await saveGlobalConfig({ ...rest, bailianApiKey: normalized, version: 1 });
  return { key: normalized, source: "config", keychainAvailable: keytar !== null };
}

export async function deleteBailianApiKey(): Promise<void> {
  const keytar = await loadKeytar();
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE, BAILIAN_ACCOUNT);
    } catch {
      // The disabled marker below also hides credentials when deletion fails.
    }
  }
  const cfg = await loadGlobalConfig();
  const { bailianApiKey: _key, ...rest } = cfg;
  void _key;
  await saveGlobalConfig({ ...rest, bailianKeyDisabled: true, version: 1 });
}

/**
 * For tests: reset the cached keytar promise so a fresh probe runs. Production
 * code never needs this.
 */
export function _resetKeytarCacheForTests(): void {
  keytarPromise = null;
}

export function fileFallbackPath(): string {
  return globalConfigPath();
}
