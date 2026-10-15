"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BailianApi } from "@/components/settings/bailian-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uiError } from "@/lib/ui-text";

type Props = {
  needsTopic: boolean;
  needsKey: boolean;
  initialTopic: string;
  wikiPath: string;
  isFirstRun: boolean;
};

export function Onboarding({ initialTopic, wikiPath }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      const configResponse = await fetch("/api/config", { cache: "no-store" });
      if (!configResponse.ok) throw new Error("配置读取失败，请重试。");
      const config = (await configResponse.json()) as { bailian: { configured: boolean } };
      if (!config.bailian.configured) {
        setError("请先保存自己的百炼 API 密钥，再进入知识台。");
        return;
      }
      const settingsResponse = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      if (!settingsResponse.ok) throw new Error("主题保存失败，请重试。");
      const onboardingResponse = await fetch("/api/onboarding", { method: "POST" });
      if (!onboardingResponse.ok) throw new Error("设置保存失败，请重试。");
      router.refresh();
    } catch (err) {
      setError(uiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 pb-16 pt-12">
      <header className="mb-8">
        <p className="text-caption uppercase tracking-wider text-muted-foreground">欢迎使用 LLM Wiki</p>
        <h1 className="mt-2 font-display text-display font-semibold">设置你的知识工作台</h1>
        <p className="mt-3 text-body text-muted-foreground">
          填写知识主题并保存百炼 API 密钥，即可整理资料、浏览图谱、提问和对话。
          默认已选择通义千问模型，无需 OpenRouter 账号。
        </p>
        <p className="mt-2 break-all font-mono text-caption text-muted-foreground">{wikiPath}</p>
      </header>
      <section className="mb-5 space-y-3 rounded-lg border p-4">
        <label className="block text-sm font-medium" htmlFor="wiki-topic">知识库主题</label>
        <Input
          id="wiki-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="例如：人工智能、知识管理与学习方法"
        />
        <p className="text-sm text-muted-foreground">之后可在“设置 → 常规设置”中修改。</p>
      </section>
      <BailianApi />
      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
      <div className="mt-6 flex justify-end">
        <Button onClick={() => void finish()} disabled={!topic.trim() || busy}>
          {busy ? "保存中…" : "进入知识工作台 →"}
        </Button>
      </div>
    </div>
  );
}
