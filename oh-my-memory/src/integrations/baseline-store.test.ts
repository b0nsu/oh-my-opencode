import { describe, expect, it } from "bun:test";

import { compareAgainstBaseline } from "./baseline-store";
import type { RunReport } from "../types";
import { defaultConfig } from "../config/default-config";

function mockReport(rssBytes: number, durationMs: number): RunReport {
  return {
    schemaVersion: "1.0.0",
    runId: "run_test",
    createdAt: new Date().toISOString(),
    stage: "during-test",
    command: ["bun", "test"],
    cwd: process.cwd(),
    ci: true,
    platform: { os: "linux", arch: "x64", nodeVersion: process.version },
    container: { inContainer: false },
    durationMs,
    status: "success",
    exitCode: 0,
    stdoutTail: "",
    stderrTail: "",
    samples: [
      {
        timestamp: new Date().toISOString(),
        pid: 100,
        rssBytes,
      },
    ],
    crash: { detected: false, exitCode: 0, dumps: [], symbols: [] },
    findings: [],
    artifacts: [],
    summary: {
      event: "Run completed",
      severity: "low",
      reproductionPriority: "P3",
      recommendedActions: [],
    },
  };
}

describe("compareAgainstBaseline", () => {
  it("marks regression when rss and duration increase significantly", () => {
    const report = mockReport(500 * 1024 * 1024, 40_000);
    const diff = compareAgainstBaseline(
      report,
      {
        updatedAt: new Date().toISOString(),
        peakRssBytes: 300 * 1024 * 1024,
        durationMs: 20_000,
      },
      defaultConfig,
    );

    expect(diff?.verdict).toBe("regression");
  });
});
