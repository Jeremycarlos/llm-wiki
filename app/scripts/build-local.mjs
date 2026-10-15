import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// 本地源码版直接用 next start，不生成依赖 Windows 符号链接权限的便携包。
const app = fileURLToPath(new URL("../apps/web/", import.meta.url));
const next = fileURLToPath(new URL("../apps/web/node_modules/next/dist/bin/next", import.meta.url));
const result = spawnSync(process.execPath, [next, "build"], {
  cwd: app,
  env: { ...process.env, LLM_WIKI_LOCAL_BUILD: "1" },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
