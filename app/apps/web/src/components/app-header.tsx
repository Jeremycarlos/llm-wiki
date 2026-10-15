"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { pageTitle } from "@/lib/navigation";

export function AppHeader({ onMenu, menuOpen }: { onMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname();
  const [shortcut, setShortcut] = useState("Ctrl K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform)) setShortcut("⌘ K");
  }, []);
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-card/80 px-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <button
          id="workspace-menu"
          type="button"
          onClick={onMenu}
          aria-label="打开导航菜单"
          aria-expanded={menuOpen}
          aria-controls="workspace-navigation"
          className="rounded-lg p-2 hover:bg-accent sm:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="hidden text-xs text-muted-foreground sm:block">我的知识空间</p>
          <p className="truncate text-sm font-semibold">{pageTitle(pathname)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("llm-wiki:open-search"))}
          className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
          aria-label="全局搜索"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">搜索知识、对话与功能</span>
          <kbd className="hidden rounded border px-1.5 text-xs lg:inline">{shortcut}</kbd>
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
