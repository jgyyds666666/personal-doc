import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = resolve(projectRoot, ".next", "standalone");

if (!existsSync(standaloneRoot)) {
  throw new Error("未找到 .next/standalone，请先执行 Next.js 生产构建");
}

const publicSource = resolve(projectRoot, "public");
if (existsSync(publicSource)) {
  cpSync(publicSource, resolve(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  });
}

const staticSource = resolve(projectRoot, ".next", "static");
const staticTarget = resolve(standaloneRoot, ".next", "static");
mkdirSync(resolve(standaloneRoot, ".next"), { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true, force: true });

console.log("Standalone runtime files are ready in .next/standalone");
