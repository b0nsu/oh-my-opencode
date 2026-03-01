import { resolve } from "node:path";

import { readConfig } from "../config/read-config";
import type { ConfigOverride } from "../config/read-config";
import { runInstrumentedCommand } from "../core/run-instrumented-command";
import type { RunStage } from "../types";

interface ParsedRunArgs {
  configPath?: string;
  stage: RunStage;
  label?: string;
  command: string[];
  inlineConfig: ConfigOverride;
}

function parseRunArgs(args: string[]): ParsedRunArgs {
  const commandSeparator = args.indexOf("--");
  const left = commandSeparator >= 0 ? args.slice(0, commandSeparator) : args;
  const right = commandSeparator >= 0 ? args.slice(commandSeparator + 1) : [];

  let configPath: string | undefined;
  let stage: RunStage = "custom";
  let label: string | undefined;
  const inlineConfig: ConfigOverride = {};

  for (let i = 0; i < left.length; i += 1) {
    const token = left[i];
    if (token === "--config") configPath = left[i + 1];
    if (token === "--stage") stage = (left[i + 1] as RunStage) ?? "custom";
    if (token === "--label") label = left[i + 1];
    if (token === "--out-dir") inlineConfig.outDir = left[i + 1] ?? inlineConfig.outDir;
    if (token === "--sample-interval-ms") inlineConfig.sampleIntervalMs = Number(left[i + 1]);
    if (token === "--max-samples") inlineConfig.maxSamples = Number(left[i + 1]);
    if (token === "--sentry-dsn") inlineConfig.sentryDsn = left[i + 1];
  }

  const command = right.length > 0 ? right : [];
  if (command.length === 0) {
    throw new Error("No command found. Use: oh-my-memory run -- <cmd>");
  }

  return { configPath, stage, label, command, inlineConfig };
}

export async function executeRunCommand(args: string[]): Promise<number> {
  const parsed = parseRunArgs(args);
  const config = readConfig(parsed.configPath, parsed.inlineConfig);

  const report = await runInstrumentedCommand(config, {
    stage: parsed.stage,
    label: parsed.label,
    command: parsed.command,
    cwd: process.cwd(),
  });

  const reportPath = resolve(process.cwd(), config.outDir, "runs", report.runId, "report.json");
  const headline = `[oh-my-memory] ${report.summary.severity.toUpperCase()} ${report.summary.event}`;
  process.stdout.write(`${headline}\n`);
  process.stdout.write(`report=${reportPath}\n`);

  if (report.summary.severity === "critical") {
    return report.exitCode ?? 1;
  }
  return report.exitCode ?? 1;
}
