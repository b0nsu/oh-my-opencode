import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { executeMigrateConfigCommand } from "./migrate-config-command";

describe("executeMigrateConfigCommand", () => {
  it("adds configVersion when missing", async () => {
    const tempDir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-migrate-"));
    try {
      const configPath = join(tempDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ outDir: ".oh-my-memory" }, null, 2), "utf-8");

      const code = await executeMigrateConfigCommand(["--config", configPath]);
      expect(code).toBe(0);

      const migrated = JSON.parse(readFileSync(configPath, "utf-8")) as { configVersion?: string };
      expect(migrated.configVersion).toBe("1.0.0");
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails on unsupported existing configVersion", async () => {
    const tempDir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-migrate-fail-"));
    try {
      const configPath = join(tempDir, "config.json");
      writeFileSync(configPath, JSON.stringify({ configVersion: "2.0.0" }, null, 2), "utf-8");

      const code = await executeMigrateConfigCommand(["--config", configPath]);
      expect(code).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
