"use client";

import { useEffect, useState } from "react";
import { uiError, uiLabel } from "@/lib/ui-text";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme, type UiTheme } from "@/components/theme-provider";

type SettingsResponse = {
  settings: {
    topic: string;
    requireApprovalForIngest?: boolean;
  };
  wikiPath: string;
};

export function GeneralTab() {
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);

  const [topic, setTopic] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [wikiPath, setWikiPath] = useState<string>("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as SettingsResponse;
        setTopic(data.settings.topic);
        setOriginal(data.settings.topic);
        setWikiPath(data.wikiPath);
        setRequireApproval(Boolean(data.settings.requireApprovalForIngest));
      } catch (err) {
        setError(uiError(err));
      }
    })();
  }, []);

  async function toggleRequireApproval(next: boolean) {
    setApprovalSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requireApprovalForIngest: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRequireApproval(next);
    } catch (err) {
      setError(uiError(err));
    } finally {
      setApprovalSaving(false);
    }
  }

  async function onSave() {
    setBusy(true);
    setFlash(null);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setOriginal(topic);
      setFlash("已保存。");
    } catch (err) {
      setError(uiError(err));
    } finally {
      setBusy(false);
    }
  }

  const dirty = topic !== original;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">知识库主题</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          用一句话描述 <strong>当前</strong> 知识库的范围，帮助 AI 在整理和问答时聚焦主题。
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            aria-label="知识库主题"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例如：人工智能、知识管理与学习方法"
            className="sm:flex-1"
          />
          <Button onClick={onSave} disabled={!dirty || busy}>
            {busy ? "保存中…" : "保存"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          保存位置： <code>{wikiPath || "<wiki>"}/.llm-wiki/settings.json</code>
        </p>

        <div className="mt-4 rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>
            <strong className="text-foreground">一个主题，一个知识空间</strong> 每个知识库对应一个文件夹。如果希望将不同主题（例如人工智能 <em>与</em> 个人读书笔记）分开管理，可以创建新的知识库：
          </p>
          <Link href="/settings?tab=wikis" className="mt-2 inline-block font-medium text-primary hover:underline">打开知识库管理 →</Link>
          <p className="mt-2">
            切换知识库时，知识页、对话、资料和知识规范会一起切换。
          </p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium">资料整理审批</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          开启后，先查看 AI 拟新增的知识页、内容更新和矛盾提示，确认后再应用到知识库。建议保持开启。
        </p>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={requireApproval}
            disabled={approvalSaving}
            onChange={(e) => void toggleRequireApproval(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-sm">
            应用知识草稿前，需要我确认
            {approvalSaving ? (
              <span className="ml-2 text-xs text-muted-foreground">保存中…</span>
            ) : null}
          </span>
        </label>
      </div>

      <div>
        <h2 className="text-lg font-medium">外观主题</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          切换后立即生效，设置保存到 <code>localStorage</code> ，下次访问时继续使用。
        </p>
        {/* Server can't read localStorage, so render a placeholder until the
            client mounts. Avoids a hydration-mismatch on the active button's
            background color. */}
        {themeMounted ? (
          <div className="mt-3 inline-flex rounded-md border border-border bg-secondary/40 p-1 text-sm">
            {(["light", "dark", "auto"] as UiTheme[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                aria-pressed={theme === t}
                className={
                  "rounded px-3 py-1 capitalize " +
                  (theme === t
                    ? "bg-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {uiLabel(t)}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-3 inline-block h-9 w-[14rem] rounded-md border border-border bg-secondary/40" />
        )}
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {flash ? <p className="text-sm text-muted-foreground">{flash}</p> : null}
    </div>
  );
}
