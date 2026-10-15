import Link from "next/link";
import { GuidePage } from "@/components/guide-page";

export default function LocalModelsPage() {
  return (
    <GuidePage
      title="本地模型指南"
      description="通过 Ollama 在本机运行模型。适合希望在本机处理资料、离线使用或控制云端调用量的场景。"
      sections={[
        {
          id: "choose",
          title: "本地与云端如何选择",
          content: (
            <>
              <p>
                本地模型在你的设备上推理，速度和能力取决于硬件、模型大小与上下文长度；不按云端 API
                的 Token 单独计费，但仍有设备与电力成本。
              </p>
              <p>
                云端模型免去本机部署，但操作所需内容会发送给提供商。可以按用途混用，例如用本地模型整理部分资料，用百炼完成问答。请依据实际资料和隐私要求选择。
              </p>
            </>
          ),
        },
        {
          id: "install",
          title: "1. 安装并启动 Ollama",
          content: (
            <>
              <p>
                从{" "}
                <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                  Ollama 官方下载页
                </a>{" "}
                获取对应系统的安装程序。Windows 安装后，确认本地服务已运行。
              </p>
              <p>需要手动启动时，在终端执行：</p>
              <pre>
                <code>ollama serve</code>
              </pre>
              <p>
                默认服务地址为 <code>http://localhost:11434</code>
                。如提示端口已占用，可能已有服务正在运行，请先检查。
              </p>
            </>
          ),
        },
        {
          id: "models",
          title: "2. 下载并试用模型",
          content: (
            <>
              <p>
                在{" "}
                <a href="https://ollama.com/library" target="_blank" rel="noreferrer">
                  Ollama 模型库
                </a>{" "}
                选择适合设备的模型，先用较小模型确认可正常运行。下面使用模型名作为示例，实际可用性以模型库为准：
              </p>
              <pre>
                <code>{"ollama pull llama3\nollama run llama3\nollama list"}</code>
              </pre>
              <p>
                模型权重只需下载一次。内存不足时应选择更小的模型，或关闭其他占用内存的应用。视觉输入需使用支持图片的模型，纯文本模型不能识别图片。
              </p>
            </>
          ),
        },
        {
          id: "connect",
          title: "3. 连接知识工作台",
          content: (
            <>
              <ol>
                <li>
                  打开<Link href="/settings?tab=models">设置 → 模型</Link>。
                </li>
                <li>在需要的用途下选择“Ollama（本地）”。</li>
                <li>填写或选择本机已经下载的模型名称。</li>
                <li>保存后，使用一段合成资料或简单问题验证。</li>
              </ol>
              <p>
                所有用途都选用 Ollama 时，无需配置云端密钥。不同用途仍可分别使用百炼或 OpenRouter。
              </p>
              <p>
                默认地址以外的 Ollama 服务，可在启动前设置 <code>OLLAMA_BASE_URL</code>
                。客户端会处理 OpenAI 兼容接口所需的 <code>/v1</code>{" "}
                路径。远程地址的数据传输与访问权限需要自行管理。
              </p>
            </>
          ),
        },
        {
          id: "fix",
          title: "常见问题",
          content: (
            <>
              <ul>
                <li>
                  <strong>连接失败：</strong>确认服务正在运行，检查端口和地址。
                </li>
                <li>
                  <strong>找不到模型：</strong>用 <code>ollama list</code>{" "}
                  检查已下载模型，填写完全一致的名称。
                </li>
                <li>
                  <strong>响应缓慢或内存不足：</strong>减少模型大小与输入长度，检查设备可用内存。
                </li>
                <li>
                  <strong>JSON 输出不符合要求：</strong>更换结构化输出更可靠的模型，或拆分复杂资料。
                </li>
                <li>
                  <strong>图片或 PDF 失败：</strong>确认模型与接口支持输入格式；PDF
                  不等同于图片，必要时先转换。
                </li>
              </ul>
              <p>
                硬件支持及安装问题可查看{" "}
                <a href="https://github.com/ollama/ollama" target="_blank" rel="noreferrer">
                  Ollama 官方项目
                </a>
                ，工作台操作见<Link href="/help">使用帮助</Link>。
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
