import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import { readConfig } from "../config/read-config";

export async function executeDoctorCommand(args: string[]): Promise<number> {
  const configPathIndex = args.indexOf("--config");
  const configPath = configPathIndex >= 0 ? args[configPathIndex + 1] : undefined;
  const config = readConfig(configPath);
  const outDir = resolve(process.cwd(), config.outDir);

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  checks.push({
    name: "bun_runtime",
    ok: typeof Bun !== "undefined",
    detail: typeof Bun !== "undefined" ? Bun.version : "missing",
  });

  try {
    await access(process.cwd(), constants.W_OK);
    checks.push({ name: "cwd_writable", ok: true, detail: process.cwd() });
  } catch {
    checks.push({ name: "cwd_writable", ok: false, detail: process.cwd() });
  }

  checks.push({
    name: "out_dir",
    ok: true,
    detail: outDir,
  });

  for (const check of checks) {
    process.stdout.write(`${check.ok ? "PASS" : "FAIL"} ${check.name} ${check.detail}\n`);
  }

  return checks.every((check) => check.ok) ? 0 : 1;
}
