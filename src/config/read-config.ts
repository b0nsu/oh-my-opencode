import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import { join, resolve } from "node:path";

import { defaultConfig } from "./default-config";
import type { OhMyMemoryConfig } from "../types";

export type ConfigOverride = Partial<Omit<OhMyMemoryConfig, "baselineThresholds" | "redaction">> & {
  baselineThresholds?: Partial<OhMyMemoryConfig["baselineThresholds"]>;
  redaction?: Partial<OhMyMemoryConfig["redaction"]>;
};

interface ConfigInput {
  outDir?: string;
  sampleIntervalMs?: number;
  maxSamples?: number;
  logTailBytes?: number;
  maxArtifactBytes?: number;
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
  redaction?: {
    enabled?: boolean;
    replacement?: string;
    patterns?: string[];
  };
  plugins?: {
    collectors?: string[];
    reporters?: string[];
  };
}

export interface ResolvedConfigResult {
  config: OhMyMemoryConfig;
  sources: string[];
}

function sanitizeNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function parseJsonc(input: string): unknown {
  const withoutBlockComments = input.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/(^|\s)\/\/.*$/gm, "$1");
  const normalized = withoutLineComments.replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(normalized);
}

function readConfigFile(path: string): ConfigInput | undefined {
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, "utf-8");
  const parsed = parseJsonc(raw);
  if (!parsed || typeof parsed !== "object") return undefined;
  return parsed as ConfigInput;
}

function userConfigCandidates(): string[] {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) return [];
    return [
      join(appData, "oh-my-memory", "config.jsonc"),
      join(appData, "oh-my-memory", "config.json"),
    ];
  }

  const base = join(os.homedir(), ".config", "oh-my-memory");
  return [join(base, "config.jsonc"), join(base, "config.json")];
}

function projectConfigCandidates(cwd: string): string[] {
  return [
    join(cwd, ".oh-my-memory.config.jsonc"),
    join(cwd, ".oh-my-memory.config.json"),
    join(cwd, "oh-my-memory.config.jsonc"),
    join(cwd, "oh-my-memory.config.json"),
  ];
}

function mergeConfig(base: ConfigInput, override: ConfigInput): ConfigInput {
  return {
    ...base,
    ...override,
    baselineThresholds: {
      ...(base.baselineThresholds ?? {}),
      ...(override.baselineThresholds ?? {}),
    },
    redaction: {
      ...(base.redaction ?? {}),
      ...(override.redaction ?? {}),
    },
    plugins: {
      ...(base.plugins ?? {}),
      ...(override.plugins ?? {}),
    },
  };
}

function buildMergedInput(configPath?: string, inline?: ConfigOverride): { merged: ConfigInput; sources: string[] } {
  const cwd = process.cwd();
  let merged: ConfigInput = {};
  const sources: string[] = [];

  for (const candidate of userConfigCandidates()) {
    const loaded = readConfigFile(candidate);
    if (!loaded) continue;
    merged = mergeConfig(merged, loaded);
    sources.push(candidate);
    break;
  }

  for (const candidate of projectConfigCandidates(cwd)) {
    const loaded = readConfigFile(candidate);
    if (!loaded) continue;
    merged = mergeConfig(merged, loaded);
    sources.push(candidate);
    break;
  }

  if (configPath) {
    const explicitPath = resolve(configPath);
    const loaded = readConfigFile(explicitPath);
    if (loaded) {
      merged = mergeConfig(merged, loaded);
      sources.push(explicitPath);
    }
  }

  if (inline) {
    merged = mergeConfig(merged, inline);
    sources.push("<inline>");
  }

  return { merged, sources };
}

export function readConfigWithMeta(configPath?: string, inline?: ConfigOverride): ResolvedConfigResult {
  const { merged: fileMerged, sources } = buildMergedInput(configPath, inline);

  const merged = {
    ...defaultConfig,
    ...fileMerged,
    baselineThresholds: {
      ...defaultConfig.baselineThresholds,
      ...(fileMerged.baselineThresholds ?? {}),
    },
    redaction: {
      ...defaultConfig.redaction,
      ...(fileMerged.redaction ?? {}),
    },
    plugins: {
      ...defaultConfig.plugins,
      ...(fileMerged.plugins ?? {}),
    },
  };

  const sentryDsn =
    merged.sentryDsn ??
    (merged.sentryDsnEnv ? process.env[merged.sentryDsnEnv] : undefined) ??
    undefined;

  return {
    config: {
      outDir: merged.outDir,
      sampleIntervalMs: sanitizeNumber(merged.sampleIntervalMs, defaultConfig.sampleIntervalMs),
      maxSamples: sanitizeNumber(merged.maxSamples, defaultConfig.maxSamples),
      logTailBytes: sanitizeNumber(merged.logTailBytes, defaultConfig.logTailBytes),
      maxArtifactBytes: sanitizeNumber(merged.maxArtifactBytes, defaultConfig.maxArtifactBytes),
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
      redaction: {
        enabled: merged.redaction.enabled ?? defaultConfig.redaction.enabled,
        replacement: merged.redaction.replacement ?? defaultConfig.redaction.replacement,
        patterns: Array.isArray(merged.redaction.patterns)
          ? merged.redaction.patterns
          : defaultConfig.redaction.patterns,
      },
      plugins: {
        collectors: Array.isArray(merged.plugins.collectors)
          ? merged.plugins.collectors
          : defaultConfig.plugins.collectors,
        reporters: Array.isArray(merged.plugins.reporters)
          ? merged.plugins.reporters
          : defaultConfig.plugins.reporters,
      },
    },
    sources,
  };
}

export function readConfig(configPath?: string, inline?: ConfigOverride): OhMyMemoryConfig {
  return readConfigWithMeta(configPath, inline).config;
}
