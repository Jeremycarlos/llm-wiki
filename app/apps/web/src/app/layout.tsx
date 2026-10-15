import type { Metadata } from "next";

import { AppShell } from "@/components/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { THEME_INIT_SCRIPT, ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Wiki · 我的知识工作台",
  description: "以本地文件为基础，用 AI 整理、关联和探索你的知识。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
    >
      <head>
        {/* Runs before hydration to avoid a light->dark flash on first paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex h-screen flex-col overflow-hidden">
        <ThemeProvider>
          <AppShell>{children}</AppShell>
          <CommandPalette />
        </ThemeProvider>
      </body>
    </html>
  );
}
