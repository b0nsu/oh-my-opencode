import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

import { metricSupportMatrix } from "../collectors/process-sampler";
import { readConfigWithMeta } from "../config/read-config";
import { inspectPluginPaths, loadCollectorPlugins, loadReporterPlugins } from "../plugins/load-plugins";

export async function executeDoctorCommand(args: string[]): Promise<number> {
  const configPathIndex = args.indexOf("--config");
  const configPath = configPathIndex >= 0 ? args[configPathIndex + 1] : undefined;
  const resolved = readConfigWithMeta(configPath);
  const config = resolved.config;
  const outDir = resolve(process.cwd(), config.outDir);

  const checks: Array<{ name: string; ok: boolean; detail: string }> = [];

  checks.push({
    name: "bun_runtime",
    ok: typeof Bun !== "undefined",
    detail: typeof Bun !== "undefined" ? Bun.version : "missing",
  });

  try {
    await access(process.cwd(), constants.W_OK);
    checks.push({ name: "cwd_writable", ok: true, detail: process.cwd() });
  } catch {
    checks.push({ name: "cwd_writable", ok: false, detail: process.cwd() });
  }

  checks.push({
    name: "out_dir",
    ok: true,
    detail: outDir,
  });

  checks.push({
    name: "config_sources",
    ok: true,
    detail: resolved.sources.length > 0 ? resolved.sources.join(",") : "defaults_only",
  });

  for (const item of metricSupportMatrix()) {
    checks.push({
      name: `metric_${item.metric}`,
      ok: true,
      detail: `${item.mode}:${item.reason}`,
    });
  }

  const collectorPaths = inspectPluginPaths(process.cwd(), config.plugins.collectors);
  for (const item of collectorPaths) {
    checks.push({
      name: "plugin_collector_path",
      ok: item.ok,
      detail: `${item.requestedPath}:${item.reason}`,
    });
  }

  const reporterPaths = inspectPluginPaths(process.cwd(), config.plugins.reporters);
  for (const item of reporterPaths) {
    checks.push({
      name: "plugin_reporter_path",
      ok: item.ok,
      detail: `${item.requestedPath}:${item.reason}`,
    });
  }

  const collectorLoad = await loadCollectorPlugins(process.cwd(), config.plugins.collectors);
  checks.push({
    name: "plugin_collector_load",
    ok: collectorLoad.issues.length === 0,
    detail: collectorLoad.issues.length === 0 ? "ok" : collectorLoad.issues.map((item) => `${item.path}:${item.reason}`).join(","),
  });

  const reporterLoad = await loadReporterPlugins(process.cwd(), config.plugins.reporters);
  checks.push({
    name: "plugin_reporter_load",
    ok: reporterLoad.issues.length === 0,
    detail: reporterLoad.issues.length === 0 ? "ok" : reporterLoad.issues.map((item) => `${item.path}:${item.reason}`).join(","),
  });

  for (const check of checks) {
    process.stdout.write(`${check.ok ? "PASS" : "FAIL"} ${check.name} ${check.detail}\n`);
  }

  return checks.every((check) => check.ok) ? 0 : 1;
}
