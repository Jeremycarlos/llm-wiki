# LLM Wiki 知识库模板

这是一个经过脱敏的 LLM Wiki 知识库模板，用于分享知识库的组织规则和演示摄取流程，同时把个人语料、生成页面、聊天记录、运行状态与凭证留在本地。

## 公开内容

- `CLAUDE.md`：知识页写作、来源与发布边界。
- `raw/demo-*.md`：明确标注为演示数据的安全示例。
- `index.example.md`、`log.example.md`：首次使用时可复制的空白文件。
- `publish-allowlist.txt`：允许公开的文件白名单。

## 默认不公开的内容

- `.llm-wiki/`：本地设置、数据库、页面历史和回收站。
- `raw/` 中非演示文件：原始论文、网页正文或其他底层语料。
- `wiki/`：由私有语料生成的知识页。
- `chats/`：聊天或会话数据。
- `index.md`、`log.md`：知识目录与操作轨迹。
- `.env`、密钥文件、凭证 JSON 和本地数据库。

这些文件仍可在本机正常保存，但不会被 Git 纳入提交。不要使用 `git add -f` 绕过保护。

## 本地初始化

克隆后，如工具尚未自动创建索引和日志，可在 PowerShell 中执行：

```powershell
Copy-Item index.example.md index.md
Copy-Item log.example.md log.md
```

随后将自己的资料放入 `raw/`，生成内容放入 `wiki/`。它们默认保持私有。

## 发布前检查

1. 运行 `powershell -ExecutionPolicy Bypass -File scripts/check-sensitive.ps1`。
2. 查看 `git status --short`，确认没有私有文件进入待提交列表。
3. 对照 `publish-allowlist.txt` 人工复核每个公开文件。
4. 只有在确认扫描通过后，再提交并推送到 GitHub。

> 本仓库保存的是知识库规则与示例数据，不包含独立运行的应用程序。若希望他人直接运行完整系统，还需要另行提供相应程序、安装方式和依赖说明。
