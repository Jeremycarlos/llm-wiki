# 开发与验证

本项目的完整应用位于 `app/`，使用 Next.js、React、TypeScript 和 pnpm workspace。`apps/web` 提供中文界面与 API，`packages/core` 管理知识库，`packages/llm` 处理模型路由，`packages/ingestion` 解析资料。

在 `app/` 下运行：

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build:local
pnpm start
```

新用户默认使用百炼 `qwen-plus`，图片理解使用 `qwen3-vl-plus`。首次启动只要求用户填写自己的知识主题和百炼密钥；已有知识库保存的模型配置保持不变。

开发预览可运行 `pnpm dev`。生产构建使用 `.next/`，开发预览使用 `.next-dev/`。请使用合成资料验证功能，不要把本地知识库、配置、密钥或生成缓存加入提交。

`pnpm test` 默认跳过真实付费 API 测试；只有主动设置 `BAILIAN_LIVE_TEST=1` 才会启用合成资料联调并产生费用。发布前在仓库根目录运行 `powershell -ExecutionPolicy Bypass -File scripts/check-sensitive.ps1`。

界面截图应仅包含允许公开的演示资料，图片内容需要人工查看。文件扫描无法识别截图中的密钥。
