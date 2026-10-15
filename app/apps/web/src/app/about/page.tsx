import Link from "next/link";
import { GuidePage } from "@/components/guide-page";

export default function AboutPage() {
  return (
    <GuidePage
      title="让资料成为持续生长的知识"
      description="LLM Wiki 是一个以本地文件为基础的 AI 知识工作台。你提供资料，AI 辅助整理，最终内容由你审核和掌握。"
      sections={[
        {
          id: "idea",
          title: "知识如何积累",
          content: (
            <>
              <p>
                文章、论文和笔记并不天然形成知识体系。LLM Wiki
                帮助你从来源中提炼概念，建立知识页之间的关联，并在获得新资料后修订已有理解。
              </p>
              <p>
                这一工作方式借鉴了{" "}
                <a
                  href="https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f"
                  target="_blank"
                  rel="noreferrer"
                >
                  Andrej Karpathy 的 LLM Wiki 思路
                </a>
                ：保留原始资料，以知识规范指导 AI，持续维护可以阅读和编辑的知识页。
              </p>
            </>
          ),
        },
        {
          id: "workflow",
          title: "从收集到理解",
          content: (
            <>
              <ol>
                <li>
                  <strong>收集资料：</strong>粘贴笔记、导入网页或上传支持的文档。
                </li>
                <li>
                  <strong>审核草稿：</strong>查看拟新增的知识页、内容更新与矛盾，再确认应用。
                </li>
                <li>
                  <strong>阅读与提问：</strong>沿着知识页、引用和图谱探索，也可以向知识库提问。
                </li>
                <li>
                  <strong>持续完善：</strong>用知识检查发现失效链接、孤立知识页和内容缺口。
                </li>
              </ol>
              <p>
                适合主题研究、个人学习、读书整理与项目经验积累。不同主题可以放在独立知识库中管理。
              </p>
            </>
          ),
        },
        {
          id: "files",
          title: "文件与所有权",
          content: (
            <>
              <p>
                原始资料放在 <code>raw/</code>，知识页放在 <code>wiki/</code>，对话保存在{" "}
                <code>chats/</code>，知识规范写在 <code>CLAUDE.md</code>。内容使用 Markdown
                等通用文件格式，可在其他编辑器中继续阅读。
              </p>
              <p>
                SQLite
                保存索引、来源关系、用量等辅助数据。请将整个知识库作为备份单位，尤其保留原始资料与工具元数据。
              </p>
            </>
          ),
        },
        {
          id: "privacy",
          title: "模型、隐私与费用",
          content: (
            <>
              <p>
                知识文件保存在本机。调用云端模型时，当前操作需要的资料与上下文会发送到你选择的提供商。请根据资料的敏感程度选择百炼、OpenRouter
                或本地 Ollama。
              </p>
              <p>
                百炼密钥可在设置中安全保存，也兼容旧环境变量。用量与费用按模型、Token 阶梯和可识别地域估算；美元与人民币分开显示。历史百炼费用按北京标准非思考价估算，实际扣费可能受地域、缓存和优惠影响，请以提供商账单为准。
              </p>
              <p>
                摄取审批用于让你在修改知识页前检查草稿。建议保持开启。PDF
                输入能力因提供商而异，百炼视觉接口需先将 PDF 转换为文本或逐页图片。
              </p>
            </>
          ),
        },
        {
          id: "credits",
          title: "项目来源与许可",
          content: (
            <>
              <p>
                原项目由{" "}
                <a href="https://github.com/ddsyasas" target="_blank" rel="noreferrer">
                  Yasas
                </a>{" "}
                创建，采用 MIT 许可。
                <a href="https://github.com/ddsyasas/llm-wiki" target="_blank" rel="noreferrer">
                  查看原项目源码
                </a>
                。
              </p>
              <p>
                当前本地版本在原项目基础上加入百炼支持和中文界面。UI 参考 shadcn/ui
                的组件组织与知识管理产品的导航方式，继续使用 React、Next.js、Tailwind 和 Radix。
              </p>
              <p>
                本项目与 Karpathy、Anthropic
                等机构或个人没有官方关联。模型及服务名称属于各自提供商。
              </p>
              <p>
                <Link href="/help">查看使用帮助</Link> ·{" "}
                <Link href="/developers">查看开发者说明</Link>
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
