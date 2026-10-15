"use client";

import { useRouter } from "next/navigation";
import { uiError, uiLabel } from "@/lib/ui-text";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "@/components/wiki/markdown-view";

const PAGE_TYPES = ["entity", "concept", "source", "comparison", "overview"] as const;

type Props = {
  slug: string;
  initialTitle: string;
  initialType: (typeof PAGE_TYPES)[number];
  initialContent: string;
  knownSlugs: ReadonlyArray<string>;
  onCancel: () => void;
  onSaved: () => void;
};

export function PageEditor({
  slug,
  initialTitle,
  initialType,
  initialContent,
  knownSlugs,
  onCancel,
  onSaved,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [type, setType] = useState<(typeof PAGE_TYPES)[number]>(initialType);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${encodeURIComponent(slug)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, type, content }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Refresh the route's server component data so the rendered view + sidebar
      // see the new content.
      router.refresh();
      onSaved();
    } catch (err) {
      setError(uiError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="知识页标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="flex-1"
        />
        <select
          aria-label="知识页类型"
          value={type}
          onChange={(e) => setType(e.target.value as (typeof PAGE_TYPES)[number])}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {PAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {uiLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {/* Split pane fills the available viewport height so the editor feels
          like a real editing surface. Both panes share the same border /
          padding / min-height for visual symmetry. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Markdown
          </h3>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[calc(100vh-22rem)] flex-1 resize-none rounded-md border-border/70 bg-card p-5 font-mono text-[13px] leading-relaxed"
          />
        </div>
        <div className="flex flex-col">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            预览
          </h3>
          <div className="min-h-[calc(100vh-22rem)] flex-1 overflow-y-auto rounded-md border border-border/70 bg-card p-5">
            <MarkdownView content={content} knownSlugs={knownSlugs} />
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          取消
        </Button>
      </div>
    </div>
  );
}
