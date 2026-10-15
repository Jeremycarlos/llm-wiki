"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageContainer, PageHeader } from "@/components/page-shell";
import { AboutTab } from "@/components/settings/about-tab";
import { ApiTab } from "@/components/settings/api-tab";
import { CostsTab } from "@/components/settings/costs-tab";
import { GeneralTab } from "@/components/settings/general-tab";
import { ModelsTab } from "@/components/settings/models-tab";
import { WikisTab } from "@/components/settings/wikis-tab";
import { cn } from "@/lib/utils";

type Tab = "general" | "wikis" | "models" | "api" | "costs" | "about";
const TAB_ORDER: Tab[] = ["general", "wikis", "models", "api", "costs", "about"];
const TAB_LABEL: Record<Tab, string> = {
  general: "常规设置",
  wikis: "知识库管理",
  models: "模型",
  api: "API",
  costs: "用量与费用",
  about: "关于",
};

function parseTab(raw: string | null): Tab {
  return TAB_ORDER.includes(raw as Tab) ? (raw as Tab) : "general";
}

export default function SettingsPage() {
  const search = useSearchParams();
  // Read ?tab= on mount so links like /settings?tab=wikis (from the header
  // dropdown or anywhere else) deep-link straight to the right pane.
  const initialTab = parseTab(search?.get("tab") ?? null);
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    const next = parseTab(search?.get("tab") ?? null);
    setTab(next);
  }, [search]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="工作台配置"
        title="设置"
        description="模型设置保存在当前知识库。百炼密钥优先保存在系统钥匙串，也兼容旧环境变量配置。"
      />

      <nav
        role="tablist"
        className="mb-5 flex w-full overflow-x-auto whitespace-nowrap rounded-md border border-border/70 bg-secondary/40 p-1 text-ui"
      >
        {TAB_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded px-3 py-2",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </nav>

      <section className="rounded-lg border border-border/70 bg-card p-5 text-card-foreground">
        {tab === "general" ? <GeneralTab /> : null}
        {tab === "wikis" ? <WikisTab /> : null}
        {tab === "models" ? <ModelsTab /> : null}
        {tab === "api" ? <ApiTab /> : null}
        {tab === "costs" ? <CostsTab /> : null}
        {tab === "about" ? <AboutTab /> : null}
      </section>
    </PageContainer>
  );
}
