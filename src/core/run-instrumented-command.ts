import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { join, resolve } from "node:path";

import { collectCrashArtifacts } from "../collectors/crash-artifact-scanner";
import { detectContainerContext } from "../collectors/container-context";
import { collectProcessSample, platformInfo } from "../collectors/process-sampler";
import { deriveFindings, deriveSummary } from "../analysis/derive-insights";
import { loadBaseline, compareAgainstBaseline, saveBaseline } from "../integrations/baseline-store";
import { emitSentryEventIfConfigured } from "../integrations/sentry-integration";
import { writeMarkdownReport } from "../reporters/write-markdown-report";
import { writeJsonReport } from "../reporters/write-json-report";
import { loadCollectorPlugins, loadReporterPlugins } from "../plugins/load-plugins";
import { ensureDir, writeText } from "../shared/file-utils";
import { redactReport } from "../shared/redaction";
import { RingBuffer } from "../shared/ring-buffer";
import type { OhMyMemoryConfig, ResourceSample, RunOptions, RunReport } from "../types";

function makeRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function runInstrumentedCommand(config: OhMyMemoryConfig, options: RunOptions): Promise<RunReport> {
  const runId = makeRunId();
  const runDir = resolve(options.cwd, config.outDir, "runs", runId);
  const artifactsDir = join(runDir, "artifacts");
  const crashDir = join(artifactsDir, "crash");

  await ensureDir(runDir);
  await ensureDir(artifactsDir);

  const collectorLoad = await loadCollectorPlugins(options.cwd, config.plugins.collectors);
  const reporterLoad = await loadReporterPlugins(options.cwd, config.plugins.reporters);
  const collectorPlugins = collectorLoad.plugins;
  const reporterPlugins = reporterLoad.plugins;

  const stdoutTail = new RingBuffer(config.logTailBytes);
  const stderrTail = new RingBuffer(config.logTailBytes);
  const startAt = Date.now();

  const [command, ...args] = options.command;
  if (!command) {
    throw new Error("Missing command to execute");
  }

  let child: ChildProcess;
  try {
    child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const failedReport: RunReport = {
      schemaVersion: "1.0.0",
      runId,
      createdAt: new Date().toISOString(),
      stage: options.stage,
      label: options.label,
      command: options.command,
      cwd: options.cwd,
      ci: process.env.CI === "true",
      platform: platformInfo(),
      container: detectContainerContext(),
      durationMs: Date.now() - startAt,
      status: "failed",
      exitCode: 1,
      stdoutTail: stdoutTail.read(),
      stderrTail: stderrTail.read(),
      samples: [],
      crash: {
        detected: false,
        exitCode: 1,
        dumps: [],
        symbols: [],
      },
      findings: [
        {
          id: "spawn-failed",
          title: "Command process failed to start",
          severity: "high",
          evidence: [String(error)],
        },
      ],
      artifacts: [],
      summary: deriveSummary({
        ci: process.env.CI === "true",
        status: "failed",
        findings: [
          {
            id: "spawn-failed",
            title: "Command process failed to start",
            severity: "high",
            evidence: [String(error)],
          },
        ],
      }),
    };

    const redacted = redactReport(failedReport, config);
    const jsonPath = await writeJsonReport(runDir, redacted);
    await writeMarkdownReport(runDir, redacted);
    await writeText(join(runDir, "latest-report-path.txt"), `${jsonPath}\n`);
    await writeText(resolve(options.cwd, config.outDir, "latest-report-path.txt"), `${jsonPath}\n`);
    return redacted;
  }

  child.stdout?.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    stdoutTail.push(text);
    process.stdout.write(text);
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    stderrTail.push(text);
    process.stderr.write(text);
  });

  const samples: ResourceSample[] = [];
  const timer = setInterval(() => {
    if (!child.pid) return;
    if (samples.length >= config.maxSamples) return;
    let sample = collectProcessSample(child.pid);
    for (const plugin of collectorPlugins) {
      try {
        const patch = plugin.collectSample?.({
          sample,
          pid: child.pid,
          cwd: options.cwd,
          stage: options.stage,
        });
        if (patch && typeof patch === "object") {
          sample = {
            ...sample,
            ...patch,
          };
        }
      } catch {
        findings.push({
          id: "plugin-collector-runtime-failure",
          title: "Collector plugin failed during sample collection",
          severity: "medium",
          evidence: [plugin.name ?? "unknown-collector"],
        });
        continue;
      }
    }
    samples.push(sample);
  }, config.sampleIntervalMs);

  const result = await new Promise<{
    exitCode: number | null;
    signal: NodeJS.Signals | null;
    spawnError?: string;
  }>((resolveResult) => {
    child.on("error", (error) => {
      resolveResult({ exitCode: 1, signal: null, spawnError: String(error) });
    });
    child.on("exit", (exitCode, signal) => {
      resolveResult({ exitCode, signal });
    });
  });

  clearInterval(timer);

  const durationMs = Date.now() - startAt;
  const status = result.exitCode === 0 ? "success" : "failed";

  const crash = await collectCrashArtifacts({
    cwd: options.cwd,
    patterns: config.crashPatterns,
    artifactCrashDir: crashDir,
    includeSymbols: config.symbolGlobs,
    maxArtifactBytes: config.maxArtifactBytes,
  });

  const findings = deriveFindings({
    stderrTail: stderrTail.read(),
    exitCode: result.exitCode,
    samplesPeakRss: samples.reduce((max, sample) => Math.max(max, sample.rssBytes), 0),
    dumpsCount: crash.dumps.length,
  });

  if (result.spawnError) {
    findings.push({
      id: "spawn-error",
      title: "Command process reported startup error",
      severity: "high",
      evidence: [result.spawnError],
    });
  }

  for (const issue of collectorLoad.issues) {
    findings.push({
      id: "plugin-collector-load-failure",
      title: "Collector plugin failed to load",
      severity: "medium",
      evidence: [`path=${issue.path}`, `reason=${issue.reason}`],
    });
  }

  for (const issue of reporterLoad.issues) {
    findings.push({
      id: "plugin-reporter-load-failure",
      title: "Reporter plugin failed to load",
      severity: "medium",
      evidence: [`path=${issue.path}`, `reason=${issue.reason}`],
    });
  }

  const reportNoSummary = {
    schemaVersion: "1.0.0",
    runId,
    createdAt: new Date().toISOString(),
    stage: options.stage,
    label: options.label,
    command: options.command,
    cwd: options.cwd,
    ci: process.env.CI === "true",
    platform: platformInfo(),
    container: detectContainerContext(),
    durationMs,
    status,
    exitCode: result.exitCode,
    stdoutTail: stdoutTail.read(),
    stderrTail: stderrTail.read(),
    samples,
    crash: {
      detected: crash.dumps.length > 0 || result.signal !== null,
      signal: result.signal ?? undefined,
      exitCode: result.exitCode,
      dumps: crash.dumps,
      symbols: crash.symbols,
    },
    findings,
    artifacts: [...crash.dumps, ...crash.symbols],
  } satisfies Omit<RunReport, "summary">;

  const summary = deriveSummary({
    ci: reportNoSummary.ci,
    status: reportNoSummary.status,
    findings: reportNoSummary.findings,
  });

  const report: RunReport = {
    ...reportNoSummary,
    summary,
  };

  const safeReport = redactReport(report, config);

  const baseline = loadBaseline(resolve(options.cwd, config.baselineFile));
  const diff = compareAgainstBaseline(safeReport, baseline, config);
  if (diff?.verdict === "regression") {
    safeReport.findings.push({
      id: "baseline-regression",
      title: "Regression compared to baseline",
      severity: "high",
      evidence: [`rssDeltaBytes=${diff.rssDeltaBytes}`, `durationDeltaMs=${diff.durationDeltaMs}`],
    });
    safeReport.summary = deriveSummary({ ci: safeReport.ci, status: safeReport.status, findings: safeReport.findings });
  }

  await writeText(join(runDir, "stdout.tail.log"), safeReport.stdoutTail);
  await writeText(join(runDir, "stderr.tail.log"), safeReport.stderrTail);

  const jsonPath = await writeJsonReport(runDir, safeReport);
  await writeMarkdownReport(runDir, safeReport);
  await saveBaseline(resolve(options.cwd, config.baselineFile), safeReport);

  const sentryResult = await emitSentryEventIfConfigured({
    dsn: config.sentryDsn,
    report: safeReport,
    eventFilePath: join(runDir, "sentry-event.json"),
  });
  if (sentryResult.attempted) {
    safeReport.artifacts.push({
      name: "sentry-event",
      path: join(runDir, "sentry-event.json"),
      contentType: "application/json",
    });
  }

  await writeJsonReport(runDir, safeReport);

  for (const plugin of reporterPlugins) {
    try {
      await plugin.onReport?.({
        report: safeReport,
        runDir,
        cwd: options.cwd,
      });
    } catch {
      safeReport.findings.push({
        id: "plugin-reporter-runtime-failure",
        title: "Reporter plugin failed during report handling",
        severity: "medium",
        evidence: [plugin.name ?? "unknown-reporter"],
      });
      continue;
    }
  }

  safeReport.summary = deriveSummary({
    ci: safeReport.ci,
    status: safeReport.status,
    findings: safeReport.findings,
  });

  await writeText(join(runDir, "latest-report-path.txt"), `${jsonPath}\n`);
  await writeText(resolve(options.cwd, config.outDir, "latest-report-path.txt"), `${jsonPath}\n`);

  const severityRank = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  } as const;
  if (config.failOnSeverity) {
    const floor = severityRank[config.failOnSeverity];
    const current = severityRank[safeReport.summary.severity];
    if (current >= floor && safeReport.exitCode === 0) {
      safeReport.status = "failed";
      safeReport.exitCode = 1;
      safeReport.summary.event = `Severity gate failed (${safeReport.summary.severity})`;
      await writeJsonReport(runDir, safeReport);
      await writeMarkdownReport(runDir, safeReport);
    }
  }

  return safeReport;
}
