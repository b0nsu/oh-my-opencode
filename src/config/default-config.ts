import type { OhMyMemoryConfig } from "../types";

export const defaultConfig: OhMyMemoryConfig = {
  outDir: ".oh-my-memory",
  sampleIntervalMs: 250,
  maxSamples: 2000,
  logTailBytes: 64 * 1024,
  maxArtifactBytes: 1024 * 1024 * 1024,
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
  redaction: {
    enabled: true,
    replacement: "[REDACTED]",
    patterns: [
      "(sk-[A-Za-z0-9_-]{16,})",
      "(ghp_[A-Za-z0-9]{16,})",
      "(AKIA[0-9A-Z]{16})",
      "(AIza[0-9A-Za-z-_]{35})",
      "(xox[baprs]-[A-Za-z0-9-]{10,})",
      "(authorization\\s*:\\s*bearer\\s+[A-Za-z0-9._-]+)",
      "(password\\s*[=:]\\s*[^\\s,;]+)",
      "(api[_-]?key\\s*[=:]\\s*[^\\s,;]+)",
      "(secret\\s*[=:]\\s*[^\\s,;]+)",
    ],
  },
  plugins: {
    collectors: [],
    reporters: [],
  },
};
