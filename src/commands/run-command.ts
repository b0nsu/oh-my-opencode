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

const VALID_STAGES: RunStage[] = ["pre-test", "during-test", "post-test", "build", "custom"];

function isStage(value: string): value is RunStage {
  return VALID_STAGES.includes(value as RunStage);
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
    if (token === "--config") {
      const value = left[i + 1];
      if (!value) throw new Error("Missing value for --config");
      configPath = value;
    }
    if (token === "--stage") {
      const value = left[i + 1];
      if (!value) throw new Error("Missing value for --stage");
      if (!isStage(value)) {
        throw new Error(`Invalid --stage '${value}'. Use one of: ${VALID_STAGES.join(", ")}`);
      }
      stage = value;
    }
    if (token === "--label") {
      const value = left[i + 1];
      if (!value) throw new Error("Missing value for --label");
      label = value;
    }
    if (token === "--out-dir") inlineConfig.outDir = left[i + 1] ?? inlineConfig.outDir;
    if (token === "--sample-interval-ms") inlineConfig.sampleIntervalMs = Number(left[i + 1]);
    if (token === "--max-samples") inlineConfig.maxSamples = Number(left[i + 1]);
    if (token === "--max-artifact-bytes") inlineConfig.maxArtifactBytes = Number(left[i + 1]);
    if (token === "--sentry-dsn") inlineConfig.sentryDsn = left[i + 1];
  }

  const command = right.length > 0 ? right : [];
  if (command.length === 0) {
    throw new Error("No command found. Use: oh-my-memory run -- <cmd>");
  }

  return { configPath, stage, label, command, inlineConfig };
}

export async function executeRunCommand(args: string[]): Promise<number> {
  let parsed: ParsedRunArgs;
  try {
    parsed = parseRunArgs(args);
  } catch (error) {
    process.stderr.write(`[oh-my-memory] ${String(error)}\n`);
    process.stderr.write("Usage: oh-my-memory run --stage <pre-test|during-test|post-test|build|custom> -- <cmd>\n");
    return 1;
  }

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
