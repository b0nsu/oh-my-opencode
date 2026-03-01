import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { executeDoctorCommand } from "./doctor-command";

describe("executeDoctorCommand plugin checks", () => {
  it("returns success with default config", async () => {
    const code = await executeDoctorCommand([]);
    expect(code).toBe(0);
  });

  it("fails when plugin path is invalid", async () => {
    const tempDir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-doctor-"));
    try {
      const configPath = join(tempDir, "config.json");
      writeFileSync(
        configPath,
        JSON.stringify(
          {
            plugins: {
              collectors: ["https://example.com/collector.mjs"],
              reporters: [],
            },
          },
          null,
          2,
        ),
        "utf-8",
      );

      const code = await executeDoctorCommand(["--config", configPath]);
      expect(code).toBe(1);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
