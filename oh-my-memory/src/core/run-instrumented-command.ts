import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

import { collectCrashArtifacts } from "../collectors/crash-artifact-scanner";
import { detectContainerContext } from "../collectors/container-context";
import { collectProcessSample, platformInfo } from "../collectors/process-sampler";
import { deriveFindings, deriveSummary } from "../analysis/derive-insights";
import { loadBaseline, compareAgainstBaseline, saveBaseline } from "../integrations/baseline-store";
import { emitSentryEventIfConfigured } from "../integrations/sentry-integration";
import { writeMarkdownReport } from "../reporters/write-markdown-report";
import { writeJsonReport } from "../reporters/write-json-report";
import { ensureDir, writeText } from "../shared/file-utils";
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

  const stdoutTail = new RingBuffer(config.logTailBytes);
  const stderrTail = new RingBuffer(config.logTailBytes);
  const startAt = Date.now();

  const [command, ...args] = options.command;
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

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
    samples.push(collectProcessSample(child.pid));
  }, config.sampleIntervalMs);

  const result = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((resolveResult) => {
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
  });

  const findings = deriveFindings({
    stderrTail: stderrTail.read(),
    exitCode: result.exitCode,
    samplesPeakRss: samples.reduce((max, sample) => Math.max(max, sample.rssBytes), 0),
    dumpsCount: crash.dumps.length,
  });

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

  const baseline = loadBaseline(resolve(options.cwd, config.baselineFile));
  const diff = compareAgainstBaseline(report, baseline, config);
  if (diff?.verdict === "regression") {
    report.findings.push({
      id: "baseline-regression",
      title: "Regression compared to baseline",
      severity: "high",
      evidence: [`rssDeltaBytes=${diff.rssDeltaBytes}`, `durationDeltaMs=${diff.durationDeltaMs}`],
    });
    report.summary = deriveSummary({ ci: report.ci, status: report.status, findings: report.findings });
  }

  await writeText(join(runDir, "stdout.tail.log"), report.stdoutTail);
  await writeText(join(runDir, "stderr.tail.log"), report.stderrTail);

  const jsonPath = await writeJsonReport(runDir, report);
  await writeMarkdownReport(runDir, report);
  await saveBaseline(resolve(options.cwd, config.baselineFile), report);

  const sentryResult = await emitSentryEventIfConfigured({
    dsn: config.sentryDsn,
    report,
    eventFilePath: join(runDir, "sentry-event.json"),
  });
  if (sentryResult.attempted) {
    report.artifacts.push({
      name: "sentry-event",
      path: join(runDir, "sentry-event.json"),
      contentType: "application/json",
    });
  }

  await writeJsonReport(runDir, report);
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
    const current = severityRank[report.summary.severity];
    if (current >= floor && report.exitCode === 0) {
      report.status = "failed";
      report.exitCode = 1;
      report.summary.event = `Severity gate failed (${report.summary.severity})`;
      await writeJsonReport(runDir, report);
      await writeMarkdownReport(runDir, report);
    }
  }

  return report;
}
