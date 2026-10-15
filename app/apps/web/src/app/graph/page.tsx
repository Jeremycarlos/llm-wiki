import Link from "next/link";

import { buildGraph } from "@llm-wiki/core";

import { PageContainer, PageHeader } from "@/components/page-shell";
import { VaultGraph } from "@/components/graph/vault-graph";
import { openWikiContext, requireSetup } from "@/lib/server-wiki";

export const dynamic = "force-dynamic";

// Single param so the route is bookmarkable. The client component reads
// initialSelectedId on mount and flies the camera to that node once the
// force layout has settled.
type SearchParams = { node?: string };

export default async function GraphPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await requireSetup();
  const ctx = await openWikiContext();
  let data;
  try {
    data = await buildGraph(ctx.wikiPath, ctx.db);
  } finally {
    ctx.db.close();
  }

  if (data.nodes.length === 0) {
    return (
      <PageContainer width="lg">
        <PageHeader
          eyebrow="知识图谱"
          title="知识图谱"
          description="每个节点是一篇知识页，连线表示页面关联。拖动旋转，滚动缩放，点击节点查看详情。"
        />
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="font-display text-h3 font-semibold">
            还没有可展示的知识关联
          </p>
          <p className="mx-auto mt-2 max-w-md text-ui text-muted-foreground">
            前往{" "}
            <Link
              href="/sources"
              className="text-primary underline underline-offset-2"
            >
              资料管理
            </Link>{" "}
            添加并整理资料后，知识页与它们的关联会出现在这里。
          </p>
        </div>
      </PageContainer>
    );
  }

  return <VaultGraph data={data} initialSelectedId={searchParams?.node} />;
}
