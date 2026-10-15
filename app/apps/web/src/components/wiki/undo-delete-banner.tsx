"use client";

import { useRouter } from "next/navigation";
import { uiError } from "@/lib/ui-text";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type Props = {
  /** Slug of the page that was just deleted (the destination for restore). */
  slug: string;
  /** Display title for the banner copy. */
  title: string;
  /** Filename inside .llm-wiki/trash/wiki/ — passed to the restore endpoint. */
  trashFilename: string;
};

// Shown at the top of /wiki when the page-view delete flow redirects with
// ?deleted=&trash= in the URL. One-click Undo posts to the restore endpoint
// and refreshes; Dismiss clears the query params without restoring.
export function UndoDeleteBanner({ slug, title, trashFilename }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  if (hidden) return null;

  function dismiss() {
    setHidden(true);
    // Strip the query params so a refresh doesn't show the banner again.
    router.replace("/wiki");
  }

  async function undo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pages/${encodeURIComponent(slug)}/restore`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ trashFilename }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      // Restored — strip query params and refresh so the page reappears in
      // the wiki index.
      setHidden(true);
      router.replace("/wiki");
      router.refresh();
    } catch (err) {
      setError(uiError(err));
      setBusy(false);
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
      <div className="flex-1 text-emerald-800 dark:text-emerald-200">
        已将 <strong>{title}</strong> 移入回收目录。{" "}
        <span className="text-emerald-700/80 dark:text-emerald-300/80">
          可在 <code className="font-mono text-xs">.llm-wiki/trash/wiki/</code>{" "}
          中恢复，保留 30 天。
        </span>
        {error ? (
          <span className="mt-1 block text-destructive">{error}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => void undo()}
          disabled={busy}
        >
          {busy ? "恢复中…" : "撤销"}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          disabled={busy}
          className="text-xs text-emerald-700/70 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:text-emerald-100"
        >
          关闭提示
        </button>
      </div>
    </div>
  );
}
