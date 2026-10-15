"use client";

import { useRouter } from "next/navigation";
import { uiError } from "@/lib/ui-text";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AboutTab() {
  const router = useRouter();
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  async function replayTour() {
    if (!confirm("重新查看首次使用引导？已保存的主题和 API 密钥会保留。")) return;
    setReplayBusy(true);
    setReplayError(null);
    try {
      const res = await fetch("/api/onboarding", { method: "DELETE" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      // /, triggers the wizard since onboardingCompletedAt is now absent.
      router.push("/");
      router.refresh();
    } catch (err) {
      setReplayError(uiError(err));
      setReplayBusy(false);
    }
  }

  return (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-lg font-medium">LLM Wiki</h2>
        <p className="mt-1 text-muted-foreground">
          以本地文件为基础的 AI 知识工作台，原项目作者为{" "}
          <a
            href="https://github.com/ddsyasas"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Yasas
          </a>
          .
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          设计理念
        </h3>
        <p className="mt-1 text-muted-foreground">
          借鉴{" "}
          <a
            href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Andrej Karpathy 的 LLM Wiki 思路
          </a>{" "}
          ：保留原始资料，根据规范持续整理出相互关联的知识页，通过问答和检查不断完善。
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          数据与隐私
        </h3>
        <p className="mt-1 text-muted-foreground">
          文件保存在你选择的本机目录。模型调用会将当前操作所需内容发送给所选提供商：百炼、OpenRouter 或本地 Ollama。请按资料敏感程度选择模型。
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          许可
        </h3>
        <p className="mt-1 text-muted-foreground">
          MIT 许可，原项目源码：{" "}
          <a
            href="https://github.com/ddsyasas/llm-wiki"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            github.com/ddsyasas/llm-wiki
          </a>
          .
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          项目致谢
        </h3>
        <p className="mt-1 text-muted-foreground">
          基于 Next.js、Tailwind、Radix、SQLite 及 OpenAI 兼容接口构建，支持百炼、OpenRouter 与 Ollama。
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          首次使用引导
        </h3>
        <p className="mt-1 text-muted-foreground">
          可以重新查看主题、模型配置与主要功能的使用说明。
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={replayTour}
          disabled={replayBusy}
          className="mt-2"
        >
          {replayBusy ? "重置中…" : "重新查看引导"}
        </Button>
        {replayError ? (
          <p className="mt-2 text-xs text-destructive">{replayError}</p>
        ) : null}
      </div>
    </div>
  );
}
