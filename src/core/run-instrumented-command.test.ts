import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { defaultConfig } from "../config/default-config";
import { runInstrumentedCommand } from "./run-instrumented-command";

describe("runInstrumentedCommand plugin findings", () => {
  it("adds finding when plugin path is invalid", async () => {
    const tempDir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-run-"));
    try {
      const report = await runInstrumentedCommand(
        {
          ...defaultConfig,
          outDir: join(tempDir, ".oh-my-memory"),
          plugins: {
            collectors: ["https://example.com/collector.mjs"],
            reporters: [],
          },
        },
        {
          stage: "custom",
          command: ["bun", "--version"],
          cwd: tempDir,
        },
      );

      const hasLoadFailure = report.findings.some((item) => item.id === "plugin-collector-load-failure");
      expect(hasLoadFailure).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
