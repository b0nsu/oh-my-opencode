import { existsSync, readFileSync } from "node:fs";

import { writeJson } from "../shared/file-utils";
import type { OhMyMemoryConfig, RunReport } from "../types";

export interface BaselineSnapshot {
  updatedAt: string;
  peakRssBytes: number;
  durationMs: number;
}

export interface BaselineDiff {
  rssDeltaBytes: number;
  durationDeltaMs: number;
  verdict: "improved" | "neutral" | "regression";
}

export function loadBaseline(path: string): BaselineSnapshot | undefined {
  if (!existsSync(path)) return undefined;
  const parsed = JSON.parse(readFileSync(path, "utf-8")) as BaselineSnapshot;
  if (!parsed || typeof parsed !== "object") return undefined;
  return parsed;
}

export async function saveBaseline(path: string, report: RunReport): Promise<void> {
  const peakRssBytes = report.samples.reduce((max, item) => Math.max(max, item.rssBytes), 0);
  await writeJson(path, {
    updatedAt: new Date().toISOString(),
    peakRssBytes,
    durationMs: report.durationMs,
  } as BaselineSnapshot);
}

export function compareAgainstBaseline(
  report: RunReport,
  baseline: BaselineSnapshot | undefined,
  config: OhMyMemoryConfig,
): BaselineDiff | undefined {
  if (!baseline) return undefined;

  const peakRssBytes = report.samples.reduce((max, item) => Math.max(max, item.rssBytes), 0);
  const rssDeltaBytes = peakRssBytes - baseline.peakRssBytes;
  const durationDeltaMs = report.durationMs - baseline.durationMs;

  const isRegression =
    rssDeltaBytes > config.baselineThresholds.regressionRssBytes ||
    durationDeltaMs > config.baselineThresholds.regressionDurationMs;
  const isImproved =
    rssDeltaBytes < -config.baselineThresholds.improvementRssBytes &&
    durationDeltaMs < -config.baselineThresholds.improvementDurationMs;

  return {
    rssDeltaBytes,
    durationDeltaMs,
    verdict: isRegression ? "regression" : isImproved ? "improved" : "neutral",
  };
}
