"use client";

import { useCallback, useEffect, useState } from "react";
import { uiError } from "@/lib/ui-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type BailianStatus = {
  configured: boolean;
  source: "keychain" | "config" | "env" | "none";
  keychainAvailable: boolean;
  hint: string | null;
};

const SOURCE_LABEL: Record<BailianStatus["source"], string> = {
  keychain: "系统钥匙串",
  config: "用户配置文件",
  env: "服务器环境变量",
  none: "未配置",
};

export function BailianApi() {
  const [status, setStatus] = useState<BailianStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [savedBaseUrl, setSavedBaseUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"view" | "edit">("edit");
  const [busy, setBusy] = useState<"save-key" | "save-url" | "delete" | "test" | null>(null);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const [configRes, settingsRes] = await Promise.all([
        fetch("/api/config", { cache: "no-store" }),
        fetch("/api/settings", { cache: "no-store" }),
      ]);
      if (!configRes.ok || !settingsRes.ok) throw new Error("加载失败");
      const config = (await configRes.json()) as {
        bailian: BailianStatus & { baseUrl: string };
      };
      const data = (await settingsRes.json()) as { settings: { bailianBaseUrl?: string } };
      const address = data.settings.bailianBaseUrl || config.bailian.baseUrl;
      setStatus(config.bailian);
      setBaseUrl(address);
      setSavedBaseUrl(address);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const configured = status?.configured;
  useEffect(() => {
    if (configured !== undefined) setMode(configured ? "view" : "edit");
  }, [configured]);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy("save-key");
    setMessage("");
    try {
      const res = await fetch("/api/config/bailian", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: draft.trim() }),
      });
      const data = (await res.json()) as BailianStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || "保存失败");
      setStatus(data);
      setDraft("");
      setMode("view");
      setMessage(`密钥已保存到${SOURCE_LABEL[data.source]}。`);
    } catch (err) {
      setMessage(`保存失败：${uiError(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function deleteKey() {
    if (!confirm("移除保存的阿里云百炼 API 密钥？移除后不会自动回退到环境变量中的旧密钥。")) return;
    setBusy("delete");
    setMessage("");
    try {
      const res = await fetch("/api/config/bailian", { method: "DELETE" });
      const data = (await res.json()) as BailianStatus & { error?: string };
      if (!res.ok) throw new Error(data.error || "移除失败");
      setStatus(data);
      setDraft("");
      setMode("edit");
      setMessage("百炼 API 密钥已移除。");
    } catch (err) {
      setMessage(`移除失败：${uiError(err)}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveAddress() {
    setBusy("save-url");
    setMessage("");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bailianBaseUrl: baseUrl }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "保存失败");
      await refresh();
      setMessage("百炼 API 地址已保存，新请求立即生效。");
    } catch (err) {
      setMessage(uiError(err));
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMessage("正在测试百炼连接…");
    try {
      const res = await fetch("/api/config/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: "bailian" }),
      });
      const data = (await res.json()) as { ok: boolean; message: string; model?: string };
      setMessage(data.message + (data.model ? `（${data.model}）` : ""));
    } catch {
      setMessage("连接测试失败，请检查本机网络。");
    } finally {
      setBusy(null);
    }
  }

  const busyNow = busy !== null;
  const sourceDescription = (source: BailianStatus["source"]) =>
    source === "env" ? "读取自服务器环境变量" : `保存在${SOURCE_LABEL[source]}`;

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-lg border p-4">
        <div>
          <h2 className="text-lg font-medium">阿里云百炼 API 密钥</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            密钥优先保存在系统钥匙串；不可用时保存在用户配置文件。旧版 DASHSCOPE_API_KEY 环境变量仍可读取。
          </p>
        </div>

        {loadError ? (
          <div role="alert" className="text-sm">
            配置加载失败。{" "}
            <Button variant="outline" onClick={() => void refresh()}>
              重试
            </Button>
          </div>
        ) : status === null ? (
          <p className="text-sm text-muted-foreground">正在检查配置…</p>
        ) : mode === "view" && status.configured ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">当前密钥</label>
              <div className="flex items-stretch gap-2">
                <div
                  className="flex h-10 flex-1 select-none items-center rounded-md border border-input bg-muted/40 px-3 font-mono text-sm text-foreground/80"
                  aria-label="已保存的 API 密钥（已隐藏）"
                >
                  {"•".repeat(12)}{status.hint ? `…${status.hint}` : "••••"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busyNow}
                  onClick={() => {
                    setDraft("");
                    setMode("edit");
                    setMessage("");
                  }}
                >
                  更换
                </Button>
              </div>
              <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                {sourceDescription(status.source)}
                {status.hint ? <>，末尾为 <code>…{status.hint}</code></> : null}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void test()}
                disabled={busyNow || baseUrl !== savedBaseUrl}
              >
                {busy === "test" ? "测试中…" : "测试连接"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void deleteKey()} disabled={busyNow}>
                {busy === "delete" ? "移除中…" : "移除"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={saveKey} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="bailian-api-key">
                {status.configured ? "新密钥" : "输入 API 密钥"}
              </label>
              <Input
                id="bailian-api-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="输入 DashScope API Key"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                className="font-mono"
              />
              {!status.keychainAvailable ? (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  当前系统无法使用钥匙串，密钥将保存在用户目录下的配置文件中。
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!draft.trim() || busyNow}>
                {busy === "save-key" ? "保存中…" : "保存密钥"}
              </Button>
              {status.configured ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setDraft("");
                    setMode("view");
                    setMessage("");
                  }}
                  disabled={busyNow}
                >
                  取消
                </Button>
              ) : null}
            </div>
          </form>
        )}

        <div className="border-t pt-4">
          <label className="block text-sm" htmlFor="bailian-base-url">API 基础地址</label>
          <Input
            id="bailian-base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1"
            disabled={busyNow || status === null}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            填写与密钥地域匹配的官方地址，结尾为 /compatible-mode/v1。支持业务空间专属域名，勿填完整的
            /chat/completions 路径。留空使用环境变量或北京默认地址。
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              onClick={() => void saveAddress()}
              disabled={busyNow || status === null || baseUrl === savedBaseUrl}
            >
              {busy === "save-url" ? "保存中…" : "保存地址"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            测试会发送一句合成中文提示，可能产生少量费用。模型使用已保存的百炼 query 槽位，或默认 qwen-plus。
          </p>
        </div>
        {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
      </section>
    </div>
  );
}
