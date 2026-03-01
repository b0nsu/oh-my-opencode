import { join } from "node:path";

import { writeText } from "../shared/file-utils";
import type { RunReport } from "../types";

function fmtBytes(value?: number): string {
  if (!value || value <= 0) return "n/a";
  const mib = value / 1024 / 1024;
  return `${mib.toFixed(2)} MiB`;
}

export async function writeMarkdownReport(runDir: string, report: RunReport): Promise<string> {
  const lines: string[] = [];
  lines.push("# oh-my-memory Report");
  lines.push("");
  lines.push(`- Run ID: ${report.runId}`);
  lines.push(`- Stage: ${report.stage}`);
  lines.push(`- Status: ${report.status}`);
  lines.push(`- Exit code: ${report.exitCode ?? "n/a"}`);
  lines.push(`- Severity: ${report.summary.severity}`);
  lines.push(`- Reproduction priority: ${report.summary.reproductionPriority}`);
  lines.push(`- Duration: ${report.durationMs} ms`);
  lines.push("");
  lines.push("## Runtime Profile");
  lines.push(`- Sample count: ${report.samples.length}`);
  const peakRss = report.samples.reduce((max, sample) => Math.max(max, sample.rssBytes), 0);
  lines.push(`- Peak RSS: ${fmtBytes(peakRss)}`);
  lines.push(`- Container: ${report.container.inContainer ? report.container.runtime ?? "unknown" : "no"}`);
  lines.push("");

  lines.push("## Crash Capture");
  lines.push(`- Dump files: ${report.crash.dumps.length}`);
  lines.push(`- Symbol artifacts: ${report.crash.symbols.length}`);
  lines.push("");

  lines.push("## Findings");
  if (report.findings.length === 0) {
    lines.push("- No anomaly finding generated.");
  } else {
    for (const finding of report.findings) {
      lines.push(`- [${finding.severity}] ${finding.title}`);
    }
  }
  lines.push("");

  lines.push("## Recommended Actions");
  for (const action of report.summary.recommendedActions) {
    lines.push(`- ${action}`);
  }
  lines.push("");

  lines.push("## stderr tail");
  lines.push("```text");
  lines.push(report.stderrTail.trim() || "(empty)");
  lines.push("```");

  const path = join(runDir, "report.md");
  await writeText(path, lines.join("\n"));
  return path;
}
