import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const frontendRoot = resolve(repoRoot, "frontend");
const frontendNextDir = resolve(frontendRoot, ".next");
const rootNextDir = resolve(repoRoot, ".next");

execSync("npm --workspace frontend run build", {
  cwd: repoRoot,
  stdio: "inherit",
});

if (!existsSync(frontendNextDir)) {
  throw new Error(`Expected Next.js build output at ${frontendNextDir}`);
}

rmSync(rootNextDir, { recursive: true, force: true });
mkdirSync(rootNextDir, { recursive: true });
cpSync(frontendNextDir, rootNextDir, { recursive: true });
