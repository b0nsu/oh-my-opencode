import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { inspectPluginPaths, loadCollectorPlugins, loadReporterPlugins } from "./load-plugins";

describe("plugin loader", () => {
  it("loads local collector and reporter plugins", async () => {
    const dir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-plugins-"));
    try {
      const collectorPath = join(dir, "collector.mjs");
      const reporterPath = join(dir, "reporter.mjs");

      writeFileSync(
        collectorPath,
        "export default { name: 'c1', collectSample: () => ({ cpuPercent: 1 }) };",
        "utf-8",
      );
      writeFileSync(
        reporterPath,
        "export default { name: 'r1', onReport: async () => {} };",
        "utf-8",
      );

      const collectors = await loadCollectorPlugins(process.cwd(), [collectorPath]);
      const reporters = await loadReporterPlugins(process.cwd(), [reporterPath]);

      expect(collectors.plugins.length).toBe(1);
      expect(collectors.issues.length).toBe(0);
      expect(reporters.plugins.length).toBe(1);
      expect(reporters.issues.length).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rejects non-local plugin paths", async () => {
    const collectors = await loadCollectorPlugins(process.cwd(), ["https://example.com/plugin.mjs"]);
    expect(collectors.plugins.length).toBe(0);
    expect(collectors.issues[0]?.reason).toBe("non_local");
  });

  it("inspects plugin paths", () => {
    const inspected = inspectPluginPaths(process.cwd(), ["https://example.com/a.mjs", "./missing-plugin.mjs"]);
    expect(inspected.length).toBe(2);
    expect(inspected[0]?.ok).toBe(false);
    expect(inspected[0]?.reason).toBe("non_local");
    expect(inspected[1]?.ok).toBe(false);
    expect(inspected[1]?.reason).toBe("missing");
  });
});
