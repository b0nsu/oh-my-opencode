import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

import { readConfig } from "./read-config";

describe("readConfig", () => {
  const original = process.env.OH_MY_MEMORY_SENTRY_DSN;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.OH_MY_MEMORY_SENTRY_DSN;
      return;
    }
    process.env.OH_MY_MEMORY_SENTRY_DSN = original;
  });

  it("uses env sentry dsn when explicit dsn is absent", () => {
    process.env.OH_MY_MEMORY_SENTRY_DSN = "https://abc@example.ingest.sentry.io/123";
    const config = readConfig();
    expect(config.sentryDsn).toBe(process.env.OH_MY_MEMORY_SENTRY_DSN);
  });

  it("applies inline baseline thresholds", () => {
    const config = readConfig(undefined, {
      baselineThresholds: {
        regressionDurationMs: 33_000,
        improvementDurationMs: 10_000,
      },
    });

    expect(config.baselineThresholds.regressionDurationMs).toBe(33_000);
    expect(config.baselineThresholds.improvementDurationMs).toBe(10_000);
  });

  it("parses jsonc with comments and trailing commas", () => {
    const tempDir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-config-"));
    try {
      const configPath = join(tempDir, "config.jsonc");
      writeFileSync(
        configPath,
        `{
  // comment
  "sampleIntervalMs": 321,
  "baselineThresholds": {
    "regressionDurationMs": 12345,
  },
}
`,
        "utf-8",
      );

      const config = readConfig(configPath);
      expect(config.sampleIntervalMs).toBe(321);
      expect(config.baselineThresholds.regressionDurationMs).toBe(12345);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
