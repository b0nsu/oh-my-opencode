import { afterEach, describe, expect, it } from "bun:test";

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
});
