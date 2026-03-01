import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defaultConfig } from "../config/default-config";
import { parseJsonc } from "../config/read-config";
import { writeJson } from "../shared/file-utils";

export async function executeMigrateConfigCommand(args: string[]): Promise<number> {
  const configIndex = args.indexOf("--config");
  const configPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  const outIndex = args.indexOf("--out");
  const outPathArg = outIndex >= 0 ? args[outIndex + 1] : undefined;

  if (!configPath) {
    process.stderr.write("[oh-my-memory] Missing --config path\n");
    process.stderr.write("Usage: oh-my-memory migrate-config --config <path> [--out <path>]\n");
    return 1;
  }

  const inputPath = resolve(process.cwd(), configPath);
  if (!existsSync(inputPath)) {
    process.stderr.write(`[oh-my-memory] Config file not found: ${inputPath}\n`);
    return 1;
  }

  const outputPath = resolve(process.cwd(), outPathArg ?? configPath);
  const raw = readFileSync(inputPath, "utf-8");
  const parsed = parseJsonc(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    process.stderr.write("[oh-my-memory] Config file must be a JSON object\n");
    return 1;
  }

  const next = { ...(parsed as Record<string, unknown>) };
  const version = next.configVersion;
  if (typeof version === "string" && version !== defaultConfig.configVersion) {
    process.stderr.write(
      `[oh-my-memory] Unsupported configVersion '${version}'. Supported: ${defaultConfig.configVersion}\n`,
    );
    return 1;
  }

  const changed = version !== defaultConfig.configVersion;
  next.configVersion = defaultConfig.configVersion;
  await writeJson(outputPath, next);

  process.stdout.write(`migrated_config=${outputPath}\n`);
  process.stdout.write(`migration_applied=${changed ? "true" : "false"}\n`);
  return 0;
}
