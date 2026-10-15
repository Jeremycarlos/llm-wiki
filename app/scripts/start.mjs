import { spawn } from "node:child_process";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const repoRoot = resolve(appRoot, "..");
const configDir = process.env.LLM_WIKI_CONFIG_DIR || join(homedir(), ".llm-wiki-zh");
const configPath = join(configDir, "config.json");
let config = { version: 1, recentWikis: [], uiTheme: "auto" };
try {
  config = JSON.parse(await readFile(configPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const wikiPath = resolve(process.env.LLM_WIKI_PATH || config.activeWiki || join(repoRoot, ".local", "wiki"));
const port = process.env.LLM_WIKI_PORT || "3738";

try {
  await access(join(appRoot, "apps", "web", ".next", "BUILD_ID"));
} catch {
  console.error("请先在 app 目录运行 pnpm build:local，再运行 pnpm start。");
  process.exit(1);
}

await mkdir(wikiPath, { recursive: true });
// 仅为新知识库放入中文规范，不覆盖已有规则或复制任何私人语料。
try {
  await copyFile(join(repoRoot, "CLAUDE.md"), join(wikiPath, "CLAUDE.md"), constants.COPYFILE_EXCL);
} catch (error) {
  if (error.code !== "EEXIST") throw error;
}

await mkdir(configDir, { recursive: true });
await writeFile(configPath, JSON.stringify({
  ...config,
  activeWiki: wikiPath,
  recentWikis: [wikiPath, ...(config.recentWikis || []).filter((path) => path !== wikiPath)].slice(0, 10),
}, null, 2) + "\n", { mode: 0o600 });

// 不固定服务端的 LLM_WIKI_PATH，让界面中的知识库切换能够即时生效。
const env = { ...process.env, LLM_WIKI_LOCAL_BUILD: "1", LLM_WIKI_CONFIG_DIR: configDir,
  LLM_WIKI_KEYCHAIN_SERVICE: "llm-wiki-zh" };
delete env.LLM_WIKI_PATH;
const next = join(appRoot, "apps", "web", "node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "start", "-p", port, "-H", "127.0.0.1"], {
  cwd: join(appRoot, "apps", "web"),
  env,
  stdio: "inherit",
});
console.log(`知识工作台：http://127.0.0.1:${port}`);
child.on("error", (error) => {
  console.error(`启动失败：${error.message}`);
  process.exitCode = 1;
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
