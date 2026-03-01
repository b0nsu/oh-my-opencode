import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { defaultConfig } from "./default-config";
import type { OhMyMemoryConfig } from "../types";

export type ConfigOverride = Partial<Omit<OhMyMemoryConfig, "baselineThresholds">> & {
  baselineThresholds?: Partial<OhMyMemoryConfig["baselineThresholds"]>;
};

interface ConfigInput {
  outDir?: string;
  sampleIntervalMs?: number;
  maxSamples?: number;
  logTailBytes?: number;
  crashPatterns?: string[];
  symbolGlobs?: string[];
  baselineFile?: string;
  baselineThresholds?: {
    regressionRssBytes?: number;
    regressionDurationMs?: number;
    improvementRssBytes?: number;
    improvementDurationMs?: number;
  };
  failOnSeverity?: "high" | "critical";
  sentryDsn?: string;
  sentryDsnEnv?: string;
}

function sanitizeNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

export function readConfig(configPath?: string, inline?: ConfigOverride): OhMyMemoryConfig {
  let fileConfig: ConfigInput = {};
  if (configPath) {
    const resolved = resolve(configPath);
    if (existsSync(resolved)) {
      const parsed = JSON.parse(readFileSync(resolved, "utf-8")) as ConfigInput;
      fileConfig = parsed;
    }
  }

  const merged = {
    ...defaultConfig,
    ...fileConfig,
    ...inline,
    baselineThresholds: {
      ...defaultConfig.baselineThresholds,
      ...(fileConfig.baselineThresholds ?? {}),
      ...(inline?.baselineThresholds ?? {}),
    },
  };

  const sentryDsn =
    merged.sentryDsn ??
    (merged.sentryDsnEnv ? process.env[merged.sentryDsnEnv] : undefined) ??
    undefined;

  return {
    outDir: merged.outDir,
    sampleIntervalMs: sanitizeNumber(merged.sampleIntervalMs, defaultConfig.sampleIntervalMs),
    maxSamples: sanitizeNumber(merged.maxSamples, defaultConfig.maxSamples),
    logTailBytes: sanitizeNumber(merged.logTailBytes, defaultConfig.logTailBytes),
    crashPatterns: Array.isArray(merged.crashPatterns) ? merged.crashPatterns : defaultConfig.crashPatterns,
    symbolGlobs: Array.isArray(merged.symbolGlobs) ? merged.symbolGlobs : defaultConfig.symbolGlobs,
    baselineFile: merged.baselineFile,
    baselineThresholds: {
      regressionRssBytes: sanitizeNumber(
        merged.baselineThresholds.regressionRssBytes,
        defaultConfig.baselineThresholds.regressionRssBytes,
      ),
      regressionDurationMs: sanitizeNumber(
        merged.baselineThresholds.regressionDurationMs,
        defaultConfig.baselineThresholds.regressionDurationMs,
      ),
      improvementRssBytes: sanitizeNumber(
        merged.baselineThresholds.improvementRssBytes,
        defaultConfig.baselineThresholds.improvementRssBytes,
      ),
      improvementDurationMs: sanitizeNumber(
        merged.baselineThresholds.improvementDurationMs,
        defaultConfig.baselineThresholds.improvementDurationMs,
      ),
    },
    failOnSeverity: merged.failOnSeverity,
    sentryDsn,
    sentryDsnEnv: merged.sentryDsnEnv ?? defaultConfig.sentryDsnEnv,
  };
}
