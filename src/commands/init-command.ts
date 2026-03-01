import { resolve } from "node:path";

import { defaultConfig } from "../config/default-config";
import { writeText } from "../shared/file-utils";

function defaultJsoncTemplate(): string {
  return [
    "{",
    '  // Output directory for run artifacts',
    `  "outDir": "${defaultConfig.outDir}",`,
    `  "sampleIntervalMs": ${defaultConfig.sampleIntervalMs},`,
    `  "maxSamples": ${defaultConfig.maxSamples},`,
    `  "logTailBytes": ${defaultConfig.logTailBytes},`,
    `  "maxArtifactBytes": ${defaultConfig.maxArtifactBytes},`,
    `  "crashPatterns": ${JSON.stringify(defaultConfig.crashPatterns)},`,
    `  "symbolGlobs": ${JSON.stringify(defaultConfig.symbolGlobs)},`,
    `  "baselineFile": "${defaultConfig.baselineFile}",`,
    '  "baselineThresholds": {',
    `    "regressionRssBytes": ${defaultConfig.baselineThresholds.regressionRssBytes},`,
    `    "regressionDurationMs": ${defaultConfig.baselineThresholds.regressionDurationMs},`,
    `    "improvementRssBytes": ${defaultConfig.baselineThresholds.improvementRssBytes},`,
    `    "improvementDurationMs": ${defaultConfig.baselineThresholds.improvementDurationMs}`,
    "  },",
    `  "sentryDsnEnv": "${defaultConfig.sentryDsnEnv}",`,
    '  "redaction": {',
    `    "enabled": ${String(defaultConfig.redaction.enabled)},`,
    `    "replacement": "${defaultConfig.redaction.replacement}",`,
    `    "patterns": ${JSON.stringify(defaultConfig.redaction.patterns)}`,
    "  },",
    '  "plugins": {',
    `    "collectors": ${JSON.stringify(defaultConfig.plugins.collectors)},`,
    `    "reporters": ${JSON.stringify(defaultConfig.plugins.reporters)}`,
    "  }",
    "}",
    "",
  ].join("\n");
}

export async function executeInitCommand(args: string[]): Promise<number> {
  const outIndex = args.indexOf("--out");
  const outFile = outIndex >= 0 ? args[outIndex + 1] : ".oh-my-memory.config.jsonc";

  if (!outFile) {
    process.stderr.write("[oh-my-memory] Missing value for --out\n");
    return 1;
  }

  const outputPath = resolve(process.cwd(), outFile);
  await writeText(outputPath, defaultJsoncTemplate());
  process.stdout.write(`config_init=${outputPath}\n`);
  return 0;
}
