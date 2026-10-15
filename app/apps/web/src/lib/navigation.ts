export const NAV_GROUPS = [
  {
    label: "工作台",
    items: [
      { href: "/", label: "总览", icon: "home" },
      { href: "/log", label: "活动记录", icon: "history" },
    ],
  },
  {
    label: "知识管理",
    items: [
      { href: "/wiki", label: "知识库", icon: "book" },
      { href: "/sources", label: "资料管理", icon: "files" },
      { href: "/graph", label: "知识图谱", icon: "graph" },
    ],
  },
  {
    label: "AI 助手",
    items: [
      { href: "/query", label: "知识问答", icon: "search" },
      { href: "/chats", label: "AI 对话", icon: "chat" },
      { href: "/lint", label: "知识检查", icon: "check" },
    ],
  },
  {
    label: "管理",
    items: [
      { href: "/schema", label: "知识规范", icon: "schema" },
      { href: "/settings", label: "设置", icon: "settings" },
      { href: "/help", label: "帮助中心", icon: "help" },
    ],
  },
] as const;

export function isCurrentRoute(path: string, href: string): boolean {
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`);
}

export function pageTitle(path: string): string {
  return (
    NAV_GROUPS.flatMap((group) => [...group.items]).find((item) => isCurrentRoute(path, item.href))
      ?.label ??
    (
      {
        "/dashboard": "知识库概览",
        "/about": "关于 LLM Wiki",
        "/developers": "开发者说明",
        "/local-models": "本地模型指南",
      } as Record<string, string>
    )[path] ??
    "知识工作台"
  );
}
