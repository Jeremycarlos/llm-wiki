import { GuidePage } from "@/components/guide-page";

export default function DevelopersPage() {
  return (
    <GuidePage
      title="开发者说明"
      description="了解本地源码版的结构、模型调用、存储方式与验证流程。"
      sections={[
        {
          id: "structure",
          title: "源码结构",
          content: (
            <>
              <p>
                项目采用 TypeScript、React 与 Next.js App Router。界面样式基于 Tailwind 和 Radix
                风格的基础组件，SQLite 使用 better-sqlite3。
              </p>
              <ul>
                <li>
                  <code>apps/web</code>：页面、组件、API 路由与 CLI。
                </li>
                <li>
                  <code>packages/core</code>：知识库读写、数据库、资料整理、问答、对话与检查。
                </li>
                <li>
                  <code>packages/llm</code>：OpenAI 兼容客户端、错误处理、模型预设与用量估算。
                </li>
                <li>
                  <code>packages/ingestion</code>：文本、网页、Office 与视觉输入的提取。
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "storage",
          title: "文件与元数据",
          content: (
            <>
              <p>
                知识库内容保存在用户选择的目录中：<code>raw/</code> 为原始资料，<code>wiki/</code>{" "}
                为知识页，<code>chats/</code> 为对话。<code>CLAUDE.md</code> 定义整理规则，
                <code>index.md</code> 和 <code>log.md</code> 保存索引及活动。
              </p>
              <p>
                <code>.llm-wiki/meta.sqlite</code> 保存页面、资料、关联、搜索索引与用量。内容同步与
                SQLite 元数据不应被当作完整备份的替代。
              </p>
            </>
          ),
        },
        {
          id: "operations",
          title: "核心操作与 API",
          content: (
            <>
              <p>
                资料整理读取规范、索引与相关页面，模型返回经过 Zod 校验的
                JSON。启用审批时先返回预览，只有确认应用后才写入知识页。问答返回答案、引用与可选的知识页建议；对话返回普通文本。
              </p>
              <p>
                知识检查结合本地扫描与 AI 检查。快速修复通过 <code>/api/lint/fix</code>{" "}
                分发，应用修复前应让用户理解影响。
              </p>
              <ul>
                <li>
                  <code>/api/ingest</code> 与 <code>/api/ingest/apply</code>：生成与应用草稿。
                </li>
                <li>
                  <code>/api/query</code>、<code>/api/chats</code>：问答与对话。
                </li>
                <li>
                  <code>/api/settings</code>、<code>/api/config</code>：知识库设置与密钥状态。
                </li>
              </ul>
              <p>
                模型调用均使用非流式接口；结构化操作要求
                JSON，聊天使用普通文本。重试、取消信号与提供商错误映射集中在客户端封装中。
              </p>
            </>
          ),
        },
        {
          id: "providers",
          title: "提供商与输入格式",
          content: (
            <>
              <p>
                模型槽位保存 <code>provider</code> 与 <code>model</code>，支持 <code>bailian</code>
                、<code>openrouter</code>、<code>ollama</code>。百炼密钥优先从系统钥匙串读取，也兼容用户配置和服务器的{" "}
                <code>DASHSCOPE_API_KEY</code> 环境变量；API 基础地址可以按知识库设置。
              </p>
              <p>
                百炼 Qwen 调用显式关闭思考模式，使用 OpenAI 兼容的 Chat Completions。图片使用{" "}
                <code>image_url</code> 内容块，OpenRouter 专用的 PDF <code>file</code>{" "}
                附件不能直接转发到百炼。
              </p>
              <p>
                百炼用量以 <code>bailian/模型名</code>{" "}
                记录，Token 按响应记录；已知模型与地域使用独立人民币阶梯价估算，未知费率保留未知状态。更多说明见源码的{" "}
                <code>docs/bailian.md</code>。
              </p>
            </>
          ),
        },
        {
          id: "ui",
          title: "中文界面约定",
          content: (
            <>
              <p>
                页面固定使用简体中文，语言声明为
                zh-CN。显示文案与路由、枚举、模型名等内部标识分开，用户原始内容保持原样。共用导航和状态映射集中维护。
              </p>
              <p>
                新增页面应复用页面容器、页头和基础控件；提供加载、空结果、失败恢复与键盘焦点状态。不要用虚构数据填充空页面，也不要在界面或日志中暴露密钥。
              </p>
            </>
          ),
        },
        {
          id: "build",
          title: "构建、测试与启动",
          content: (
            <>
              <p>
                依赖安装在项目内。本地生产构建避免 standalone 打包在 Windows 上的符号链接权限要求：
              </p>
              <pre>
                <code>
                  {
                    "pnpm install --frozen-lockfile\npnpm test\npnpm typecheck\npnpm build:local\nnode apps/web/bin/llm-wiki.mjs start <知识库路径> --no-open --port 3738"
                  }
                </code>
              </pre>
              <p>
                真实百炼联调需要显式启用 <code>BAILIAN_LIVE_TEST=1</code>
                ，测试使用临时合成资料并会计费。不要为界面测试自动上传私人资料。
              </p>
              <p>
                原项目的 standalone 发行流程仍使用 <code>pnpm build</code>
                。本地源码修改后请重新构建并重启对应实例，不要修改全局安装包的压缩输出作为交付。
              </p>
              <p>
                <a href="https://github.com/ddsyasas/llm-wiki" target="_blank" rel="noreferrer">
                  原项目源码与 MIT 许可
                </a>
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
