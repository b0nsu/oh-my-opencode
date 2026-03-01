import type { OhMyMemoryConfig, RunReport } from "../types";

function compilePatterns(config: OhMyMemoryConfig): RegExp[] {
  if (!config.redaction.enabled) return [];
  const patterns: RegExp[] = [];
  for (const pattern of config.redaction.patterns) {
    try {
      patterns.push(new RegExp(pattern, "gi"));
    } catch {
      continue;
    }
  }
  return patterns;
}

function redactString(input: string, patterns: RegExp[], replacement: string): string {
  let next = input;
  for (const pattern of patterns) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function redactUnknown(value: unknown, patterns: RegExp[], replacement: string): unknown {
  if (typeof value === "string") {
    return redactString(value, patterns, replacement);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, patterns, replacement));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value);
  return Object.fromEntries(entries.map(([key, item]) => [key, redactUnknown(item, patterns, replacement)]));
}

export function redactReport(report: RunReport, config: OhMyMemoryConfig): RunReport {
  if (!config.redaction.enabled) return report;
  const patterns = compilePatterns(config);
  if (patterns.length === 0) return report;

  return redactUnknown(report, patterns, config.redaction.replacement) as RunReport;
}
