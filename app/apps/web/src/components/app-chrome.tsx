"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  CheckCheck,
  CircleHelp,
  Files,
  History,
  Home,
  Layers3,
  MessageSquare,
  Network,
  Search,
  Settings2,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AppHeader } from "./app-header";
import { WikiSwitcher } from "./wiki-switcher";
import { NAV_GROUPS, isCurrentRoute } from "@/lib/navigation";
import { cn } from "@/lib/utils";

const ICONS = {
  home: Home,
  history: History,
  book: BookOpen,
  files: Files,
  graph: Network,
  search: Search,
  chat: MessageSquare,
  check: CheckCheck,
  schema: SlidersHorizontal,
  settings: Settings2,
  help: CircleHelp,
};

export function AppChrome({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const items = Array.from(
          panel.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
        ).filter((el) => el.getClientRects().length);
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.getElementById("workspace-menu")?.focus();
    };
  }, [open]);
  return (
    <div className="flex h-full min-h-0 w-full">
      {open ? (
        <button
          type="button"
          aria-label="关闭导航菜单"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
        />
      ) : null}
      <aside
        ref={panel}
        id="workspace-navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-label="主导航"
        className={cn(
          "z-50 shrink-0 flex-col border-r border-border/80 bg-secondary sm:relative sm:flex sm:w-[76px] lg:w-60",
          open ? "fixed inset-y-0 left-0 flex w-64 shadow-xl" : "hidden",
        )}
      >
        <div className="flex h-20 shrink-0 items-center justify-between px-5">
          <Link href="/" aria-label="LLM Wiki 工作台" className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpen className="h-5 w-5" />
            </span>
            <span
              className={cn("text-lg font-semibold tracking-tight", !open && "hidden lg:block")}
            >
              LLM Wiki
              <span className="block text-xs font-normal tracking-normal text-muted-foreground">
                让知识持续生长
              </span>
            </span>
          </Link>
          <button
            ref={close}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭导航菜单"
            className="rounded p-1 sm:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn("px-4 pb-4", !open && "hidden lg:block")}>
          <WikiSwitcher />
        </div>
        <nav aria-label="工作台导航" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <section key={group.label}>
              <h2
                className={cn(
                  "mb-2 px-3 text-xs font-medium text-muted-foreground",
                  !open && "sr-only lg:not-sr-only",
                )}
              >
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  const active = isCurrentRoute(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.label}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                        active
                          ? "bg-primary/10 font-semibold text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                      <span className={cn(!open && "hidden lg:inline")}>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <Link
            href="/dashboard"
            title="知识库概览"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
          >
            <Layers3 className="h-[18px] w-[18px] shrink-0" />
            <span className={cn(!open && "hidden lg:inline")}>知识库概览</span>
          </Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader onMenu={() => setOpen(true)} menuOpen={open} />
        <main id="main-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
        {footer}
      </div>
    </div>
  );
}
