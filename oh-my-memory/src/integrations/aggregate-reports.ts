import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { writeJson, writeText } from "../shared/file-utils";
import type { RunReport } from "../types";

async function findReports(root: string): Promise<string[]> {
  const stack = [root];
  const reports: string[] = [];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }
      if (entry.isFile() && entry.name === "report.json") {
        reports.push(absolute);
      }
    }
  }

  return reports;
}

function crashSignature(report: RunReport): string {
  const first = report.findings[0]?.title ?? "no-finding";
  return `${report.summary.severity}:${first}`;
}

export async function aggregateReports(outDir: string): Promise<{ jsonPath: string; mdPath: string }> {
  const runsDir = join(outDir, "runs");
  const reportPaths = await findReports(runsDir);
  const reports: RunReport[] = [];
  for (const path of reportPaths) {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as RunReport;
    reports.push(parsed);
  }

  const failures = reports.filter((item) => item.status === "failed");
  const severityCount = new Map<string, number>();
  const crashCount = new Map<string, number>();

  for (const report of reports) {
    severityCount.set(report.summary.severity, (severityCount.get(report.summary.severity) ?? 0) + 1);
    if (report.status === "failed") {
      const key = crashSignature(report);
      crashCount.set(key, (crashCount.get(key) ?? 0) + 1);
    }
  }

  const topCrashes = [...crashCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const summary = {
    generatedAt: new Date().toISOString(),
    totalRuns: reports.length,
    failures: failures.length,
    failureRate: reports.length > 0 ? failures.length / reports.length : 0,
    severityCount: Object.fromEntries(severityCount.entries()),
    topCrashes,
  };

  const jsonPath = join(outDir, "aggregate.json");
  const mdPath = join(outDir, "aggregate.md");

  await writeJson(jsonPath, summary);
  await writeText(
    mdPath,
    [
      "# oh-my-memory Aggregate",
      `- Total runs: ${summary.totalRuns}`,
      `- Failures: ${summary.failures}`,
      `- Failure rate: ${(summary.failureRate * 100).toFixed(2)}%`,
      "",
      "## Top crashes",
      ...topCrashes.map(([name, count]) => `- ${name}: ${count}`),
    ].join("\n"),
  );

  return { jsonPath, mdPath };
}
