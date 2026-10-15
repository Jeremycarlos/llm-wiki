"use client";

import { useRouter } from "next/navigation";
import { uiError, uiLabel } from "@/lib/ui-text";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownView } from "@/components/wiki/markdown-view";
import { PromoteMessageDialog } from "@/components/chats/promote-message";
import { cn } from "@/lib/utils";
import type { IngestResponse } from "@llm-wiki/core";

type ChatRow = {
  id: string;
  filename: string;
  folder: string;
  title: string;
  created_at: string;
  updated_at: string;
  pinned: boolean;
  message_count: number;
};

type ChatMessage = {
  role: "user" | "assistant";
  time: string;
  content: string;
};

type ChatPayload = { row: ChatRow; messages: ChatMessage[] };

type Props = {
  chatId: string;
  initialChat: ChatPayload;
  knownSlugs: ReadonlyArray<string>;
  folders: ReadonlyArray<string>;
};

export function ChatView({ chatId, initialChat, knownSlugs, folders }: Props) {
  const router = useRouter();
  const [chat, setChat] = useState<ChatPayload>(initialChat);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(initialChat.row.title);
  const [moveOpen, setMoveOpen] = useState(false);
  const [promoteFor, setPromoteFor] = useState<ChatMessage | null>(null);

  // "Ingest whole chat as a source" — implements docs/06 §"Special case:
  // chats as sources". Runs the same ingest pipeline as a pasted text source
  // so a long, useful thread can be promoted into the wiki layer all at once
  // (vs. promoting one assistant message at a time).
  const [ingestingChat, setIngestingChat] = useState(false);
  const [ingestChatResult, setIngestChatResult] = useState<null | {
    kind?: "preview" | "applied";
    sourceId?: string;
    fullResponse?: IngestResponse;
    newPages: Array<{ slug: string; title: string }>;
    updatedPages: Array<{ slug: string }>;
  }>(null);
  const [ingestChatError, setIngestChatError] = useState<string | null>(null);
  const [applyingChat, setApplyingChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages.length, busy]);

  const folderChoices = useMemo(
    () => folders.filter((f) => f !== chat.row.folder),
    [folders, chat.row.folder],
  );

  async function refreshChat() {
    const res = await fetch(`/api/chats/${chatId}`, { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as ChatPayload;
      setChat(data);
    }
  }

  async function onSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!input.trim() || busy) return;
    setBusy(true);
    setSendError(null);
    const optimisticUser: ChatMessage = {
      role: "user",
      time: new Date().toLocaleTimeString("zh-CN"),
      content: input,
    };
    setChat((prev) => ({ ...prev, messages: [...prev.messages, optimisticUser] }));
    const sent = input;
    setInput("");

    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: sent }),
      });
      const json = (await res.json()) as {
        ok?: true;
        assistant?: ChatMessage;
        error?: string;
        providerUsed?: string;
        modelUsed?: string;
      };
      if (!res.ok || !json.ok || !json.assistant) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }


      // Re-read the chat so we get the canonical message list with server-side
      // timestamps + row metadata.
      await refreshChat();
      router.refresh(); // bumps the sidebar
    } catch (err) {

      setSendError(uiError(err));
      // Roll back the optimistic user message so the user can retry.
      setChat((prev) => ({ ...prev, messages: prev.messages.slice(0, -1) }));
      setInput(sent);
    } finally {
      setBusy(false);
    }
  }

  async function onRenameSave() {
    const t = draftTitle.trim();
    if (!t || t === chat.row.title) {
      setEditingTitle(false);
      return;
    }
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: t }),
    });
    if (res.ok) {
      setChat((prev) => ({ ...prev, row: { ...prev.row, title: t } }));
      router.refresh();
    }
    setEditingTitle(false);
  }

  async function onMove(folder: string) {
    setMoveOpen(false);
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ folder }),
    });
    if (res.ok) {
      setChat((prev) => ({ ...prev, row: { ...prev.row, folder } }));
      router.refresh();
    }
  }

  async function onTogglePin() {
    const next = !chat.row.pinned;
    const res = await fetch(`/api/chats/${chatId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pinned: next }),
    });
    if (res.ok) {
      setChat((prev) => ({ ...prev, row: { ...prev.row, pinned: next } }));
      router.refresh();
    }
  }

  async function onDelete() {
    if (!confirm(`将对话“${chat.row.title}”移入回收目录？`)) return;
    const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
      router.push("/chats");
    }
  }

  async function onIngestChat() {
    if (chat.messages.length === 0) return;
    if (
      !confirm(
        "将整段对话作为资料整理？AI 会读取对话内容，并可能新增或更新知识页。",
      )
    )
      return;
    setIngestingChat(true);
    setIngestChatError(null);
    setIngestChatResult(null);
    try {
      // Stringify messages the same way the chat file is stored so the LLM
      // sees a natural conversation transcript, not a JSON blob.
      const body = chat.messages
        .map((m) => `## ${m.role} [${m.time}]\n${m.content}`)
        .join("\n\n");
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text: body,
          title: `对话：${chat.row.title}`,
        }),
      });
      const json = (await res.json()) as {
        ok?: true;
        kind?: "preview" | "applied";
        sourceId?: string;
        fullResponse?: IngestResponse;
        response?: {
          newPages: Array<{ slug: string; title: string; type: string }>;
          pageUpdates: Array<{ slug: string; updateReason: string }>;
        };
        error?: string;
      };
      if (!res.ok || !json.ok || !json.response) {
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }
      setIngestChatResult({
        kind: json.kind,
        sourceId: json.sourceId,
        ...(json.fullResponse ? { fullResponse: json.fullResponse } : {}),
        newPages: json.response.newPages.map((p) => ({ slug: p.slug, title: p.title })),
        updatedPages: json.response.pageUpdates.map((p) => ({ slug: p.slug })),
      });
    } catch (err) {
      setIngestChatError(uiError(err));
    } finally {
      setIngestingChat(false);
    }
  }

  async function applyChatDraft() {
    if (!ingestChatResult?.fullResponse || !ingestChatResult.sourceId) return;
    setApplyingChat(true);
    setIngestChatError(null);
    try {
      const res = await fetch("/api/ingest/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceId: ingestChatResult.sourceId, response: ingestChatResult.fullResponse }) });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const { fullResponse: _drop, ...applied } = ingestChatResult;
      setIngestChatResult({ ...applied, kind: "applied" });
      router.refresh();
    } catch (err) { setIngestChatError(uiError(err)); }
    finally { setApplyingChat(false); }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
        <div className="min-w-0">
          {editingTitle ? (
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={onRenameSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") void onRenameSave();
                if (e.key === "Escape") {
                  setDraftTitle(chat.row.title);
                  setEditingTitle(false);
                }
              }}
              className="h-8 text-base"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(chat.row.title);
                setEditingTitle(true);
              }}
              className="block text-left text-lg font-medium tracking-tight hover:underline"
              title="点击重命名"
            >
              {chat.row.pinned ? "★ " : ""}
              {uiLabel(chat.row.title)}
            </button>
          )}
          <p className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">
            {uiLabel(chat.row.folder)} · {chat.messages.length} 条消息
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setMoveOpen((o) => !o)}>
              移动
            </Button>
            {moveOpen && folderChoices.length > 0 ? (
              <ul className="absolute right-0 z-10 mt-1 min-w-[140px] rounded-md border border-border bg-popover p-1 shadow-md">
                {folderChoices.map((f) => (
                  <li key={f}>
                    <button
                      type="button"
                      onClick={() => onMove(f)}
                      className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent"
                    >
                      → {uiLabel(f)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={onTogglePin}>
            {chat.row.pinned ? "取消置顶" : "置顶"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onIngestChat}
            disabled={busy || ingestingChat || applyingChat || chat.messages.length === 0}
            title="将整段对话作为资料整理为知识草稿"
          >
            {ingestingChat ? "正在生成知识草稿…" : "整理为知识"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            删除
          </Button>
        </div>
      </header>

      {ingestChatResult ? (
        <div className="max-h-[55vh] shrink-0 overflow-y-auto border-b border-emerald-500/30 bg-emerald-500/10 px-6 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p role="status">
            <strong>{ingestChatResult.kind === "preview" ? "知识草稿已生成，尚未应用。" : "对话已整理到知识库。"}</strong>{" "}
            {ingestChatResult.newPages.length} 个新增知识页
            ,{" "}
            {ingestChatResult.updatedPages.length} 个更新。
          </p>
          {ingestChatResult.kind === "preview" && ingestChatResult.fullResponse ? <div className="mt-3 space-y-3">
            <p>请先审核以下新增与更新内容，再确认应用。放弃草稿会保留原始对话和待处理资料。</p>
            {[...ingestChatResult.fullResponse.newPages, ...ingestChatResult.fullResponse.pageUpdates].map((page) => <details key={page.slug} className="rounded border border-border bg-background p-3"><summary className="cursor-pointer font-medium">{"title" in page ? page.title : page.slug}</summary><div className="mt-3 max-h-80 overflow-y-auto"><MarkdownView content={page.content} knownSlugs={knownSlugs} /></div></details>)}
            {ingestChatResult.fullResponse.contradictions.map((item, index) => <p key={index} className="text-amber-800 dark:text-amber-200">内容矛盾：{item.description}</p>)}
            <div className="flex flex-wrap gap-2"><Button onClick={() => void applyChatDraft()} disabled={applyingChat}>{applyingChat ? "应用中…" : "确认并应用"}</Button><Button variant="outline" disabled={applyingChat} onClick={() => setIngestChatResult(null)}>放弃本次草稿</Button></div>
          </div> : null}
          {ingestChatResult.kind !== "preview" && ingestChatResult.newPages.length > 0 ? (
            <p className="mt-1 text-xs">
              新增：{" "}
              {ingestChatResult.newPages.map((p, i) => (
                <span key={p.slug}>
                  <a
                    href={`/wiki/${p.slug}`}
                    className="underline underline-offset-2"
                  >
                    {p.title}
                  </a>
                  {i < ingestChatResult.newPages.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
      {ingestChatError ? (
        <div className="border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          对话整理失败： {ingestChatError}
        </div>
      ) : null}

      {/*
       * Asymmetric Claude-style layout:
       *  - User messages → bubble on the right, max-w-[80%], filled bg
       *  - Assistant messages → flow on the left, full-ish width, no
       *    bubble. Long cited answers, tables, and code blocks all need
       *    width to breathe, so we don't constrain them.
       * Position alone signals who said what — role badges dropped.
       */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {chat.messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            从一个问题开始，让已有知识参与对话。
          </p>
        ) : (
          <ol className="space-y-5">
            {chat.messages.map((m, i) => (
              <li key={`${m.time}-${i}`}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-primary/10 px-4 py-3 text-sm text-foreground">
                      <MarkdownView content={m.content} knownSlugs={knownSlugs} />
                      <p className="mt-1 text-right text-xs text-muted-foreground/70">
                        {m.time}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[92%]">
                    <article className="text-sm">
                      <MarkdownView content={m.content} knownSlugs={knownSlugs} />
                    </article>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground/80">
                      <span>{m.time}</span>
                      <button
                        type="button"
                        onClick={() => setPromoteFor(m)}
                        className="hover:text-foreground"
                      >
                        保存为知识页 →
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {busy ? (
          <p className="mt-4 text-xs text-muted-foreground">
            AI 正在整理思路，请稍候…
          </p>
        ) : null}
        {sendError ? (
          <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {sendError}
          </p>
        ) : null}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={onSend} className="border-t border-border bg-background p-4">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入你的问题，或继续讨论…"
          rows={3}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void onSend();
            }
          }}
          className="text-base"
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Ctrl / ⌘ + Enter 发送</p>
          <Button type="submit" disabled={!input.trim() || busy}>
            {busy ? "发送中…" : "发送"}
          </Button>
        </div>
      </form>

      {promoteFor ? (
        <PromoteMessageDialog
          message={promoteFor}
          chatTitle={uiLabel(chat.row.title)}
          onClose={() => setPromoteFor(null)}
        />
      ) : null}
    </div>
  );
}
