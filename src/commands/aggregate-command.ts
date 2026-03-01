import { readConfig } from "../config/read-config";
import { aggregateReports } from "../integrations/aggregate-reports";

export async function executeAggregateCommand(args: string[]): Promise<number> {
  let configPath: string | undefined;
  let outDirOverride: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--config") configPath = args[i + 1];
    if (args[i] === "--out-dir") outDirOverride = args[i + 1];
  }

  const config = readConfig(configPath, outDirOverride ? { outDir: outDirOverride } : undefined);
  const result = await aggregateReports(config.outDir);
  process.stdout.write(`aggregate_json=${result.jsonPath}\n`);
  process.stdout.write(`aggregate_md=${result.mdPath}\n`);
  return 0;
}
