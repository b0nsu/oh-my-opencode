import type { AnalysisFinding, RunReport, RunSummary } from "../types";

function stackLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .filter((line) => /\s+at\s+.+:\d+:\d+/.test(line) || /#\d+\s+0x[a-fA-F0-9]+/.test(line));
}

function moduleFromStack(line: string): string | undefined {
  const match = line.match(/\(([^)]+)\)/);
  if (!match) return undefined;
  const raw = match[1];
  const chunk = raw.split(":")[0];
  return chunk.includes("/") ? chunk.slice(chunk.lastIndexOf("/") + 1) : chunk;
}

export function deriveFindings(base: {
  stderrTail: string;
  exitCode: number | null;
  samplesPeakRss: number;
  dumpsCount: number;
}): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  const stack = stackLines(base.stderrTail);
  const modules = stack.map(moduleFromStack).filter(Boolean) as string[];

  if (stack.length > 0) {
    findings.push({
      id: "stack-trace",
      title: "Stack trace observed in stderr",
      severity: "medium",
      evidence: stack.slice(0, 8),
    });
  }

  const moduleCounts = new Map<string, number>();
  for (const item of modules) {
    moduleCounts.set(item, (moduleCounts.get(item) ?? 0) + 1);
  }
  const hotModules = [...moduleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (hotModules.length > 0) {
    findings.push({
      id: "hot-modules",
      title: "Repeated modules in stack",
      severity: "low",
      evidence: hotModules.map(([name, count]) => `${name} (${count})`),
    });
  }

  const text = base.stderrTail.toLowerCase();
  if (/(segfault|segmentation fault|sigsegv|bus error|abort)/.test(text) || base.dumpsCount > 0) {
    findings.push({
      id: "hard-crash",
      title: "Hard crash indicator detected",
      severity: "critical",
      evidence: ["Crash keyword or dump artifact detected"],
    });
  }

  if (/(out of memory|oom|heap out of memory|allocation failed)/.test(text)) {
    findings.push({
      id: "memory-pressure",
      title: "Memory pressure or OOM signs",
      severity: "high",
      evidence: ["OOM keywords detected in stderr"],
    });
  }

  if (/(overflow|stack smashing|buffer overflow)/.test(text)) {
    findings.push({
      id: "overflow-signal",
      title: "Overflow-like signal observed",
      severity: "high",
      evidence: ["Overflow keyword detected"],
    });
  }

  if (base.samplesPeakRss > 0 && base.samplesPeakRss > 1.5 * 1024 * 1024 * 1024) {
    findings.push({
      id: "high-rss",
      title: "High peak RSS observed",
      severity: "medium",
      evidence: [`Peak RSS ${(base.samplesPeakRss / 1024 / 1024).toFixed(1)} MiB`],
    });
  }

  if (base.exitCode !== 0 && base.exitCode !== null && findings.length === 0) {
    findings.push({
      id: "non-zero-exit",
      title: "Command exited with non-zero code",
      severity: "medium",
      evidence: [`exitCode=${base.exitCode}`],
    });
  }

  return findings;
}

export function deriveSummary(report: Pick<RunReport, "ci" | "status" | "findings">): RunSummary {
  const severityOrder: Array<RunSummary["severity"]> = ["low", "medium", "high", "critical"];
  const current = report.findings.reduce<RunSummary["severity"]>((max, finding) => {
    return severityOrder.indexOf(finding.severity) > severityOrder.indexOf(max) ? finding.severity : max;
  }, "low");

  const event = report.status === "success" ? "Run completed" : "Failure observed";
  const reproductionPriority: RunSummary["reproductionPriority"] =
    current === "critical" ? "P0" : current === "high" ? "P1" : report.ci ? "P2" : "P3";

  const recommendedActions = [
    "Re-run with same command under oh-my-memory hook stage=pre-test/during-test/post-test.",
    "Attach JSON/Markdown report and crash bundle to issue.",
  ];
  if (current === "critical" || current === "high") {
    recommendedActions.push("Prioritize symbolized stack trace and inspect hottest modules in findings.");
  }

  return {
    event,
    severity: current,
    reproductionPriority,
    recommendedActions,
  };
}
