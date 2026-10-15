import Link from "next/link";
export const APP_VERSION = "1.2.3";
export function Footer() {
  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-card/50 px-4 py-2 text-xs text-muted-foreground sm:px-7">
      <span>
        LLM Wiki <span className="ml-1 opacity-60">v{APP_VERSION}</span>
        <span className="mx-2">·</span>
        <a
          href="https://github.com/ddsyasas"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary"
        >
          Yasas
        </a>{" "}
        /{" "}
        <a
          href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"
          target="_blank"
          rel="noreferrer"
          className="hover:text-primary"
        >
          Karpathy
        </a>
      </span>
      <div className="flex gap-4">
        <Link href="/about" className="hover:text-primary">
          关于与来源
        </Link>
        <Link href="/developers" className="hidden hover:text-primary sm:inline">
          开发者说明
        </Link>
        <Link href="/help" className="hover:text-primary">
          使用帮助
        </Link>
      </div>
    </footer>
  );
}
