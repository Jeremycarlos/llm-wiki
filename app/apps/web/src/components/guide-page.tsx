import Link from "next/link";
import { PageContainer, PageHeader } from "./page-shell";

type Section = { id: string; title: string; content: React.ReactNode };
export function GuidePage({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: Section[];
}) {
  return (
    <PageContainer width="wide">
      <PageHeader eyebrow="LLM Wiki · 使用与参考" title={title} description={description} />
      <div className="grid items-start gap-8 lg:grid-cols-[160px_minmax(0,1fr)]">
        <nav aria-label="本页目录" className="flex flex-wrap gap-2 lg:sticky lg:top-6 lg:flex-col">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {section.title}
            </a>
          ))}
        </nav>
        <div className="min-w-0 space-y-5">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-7"
            >
              <h2 className="mb-4 text-lg font-semibold">{section.title}</h2>
              <div className="prose prose-sm max-w-none dark:prose-invert">{section.content}</div>
            </section>
          ))}
          <div className="flex flex-wrap gap-5 px-2 text-sm text-primary">
            <Link href="/sources">添加资料 →</Link>
            <Link href="/settings">配置工作台 →</Link>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
