import type { OhMyMemoryConfig } from "../types";

export const defaultConfig: OhMyMemoryConfig = {
  outDir: ".oh-my-memory",
  sampleIntervalMs: 250,
  maxSamples: 2000,
  logTailBytes: 64 * 1024,
  crashPatterns: ["core", "core.*", "*.dmp", "*.mdmp", "*.stackdump"],
  symbolGlobs: ["dist/**/*.map", "dist/**/*.dSYM", "build/**/*.pdb"],
  baselineFile: ".oh-my-memory/baseline.json",
  baselineThresholds: {
    regressionRssBytes: 128 * 1024 * 1024,
    regressionDurationMs: 15_000,
    improvementRssBytes: 64 * 1024 * 1024,
    improvementDurationMs: 5_000,
  },
  failOnSeverity: undefined,
  sentryDsn: undefined,
  sentryDsnEnv: "OH_MY_MEMORY_SENTRY_DSN",
};
