import { describe, expect, it } from "bun:test";

import { deriveFindings, deriveSummary } from "./derive-insights";

describe("deriveFindings", () => {
  it("detects hard crash and oom patterns", () => {
    const findings = deriveFindings({
      stderrTail: "Segmentation fault\nFATAL ERROR: Reached heap out of memory",
      exitCode: 134,
      samplesPeakRss: 2 * 1024 * 1024 * 1024,
      dumpsCount: 1,
    });

    const ids = new Set(findings.map((item) => item.id));
    expect(ids.has("hard-crash")).toBe(true);
    expect(ids.has("memory-pressure")).toBe(true);
    expect(ids.has("high-rss")).toBe(true);
  });
});

describe("deriveSummary", () => {
  it("returns P0 for critical findings", () => {
    const summary = deriveSummary({
      ci: true,
      status: "failed",
      findings: [
        {
          id: "x",
          title: "critical",
          severity: "critical",
          evidence: ["x"],
        },
      ],
    });

    expect(summary.reproductionPriority).toBe("P0");
    expect(summary.severity).toBe("critical");
  });
});
