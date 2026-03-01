import { readConfigWithMeta } from "../config/read-config";

export async function executePrintConfigCommand(args: string[]): Promise<number> {
  const configPathIndex = args.indexOf("--config");
  const configPath = configPathIndex >= 0 ? args[configPathIndex + 1] : undefined;

  if (configPathIndex >= 0 && !configPath) {
    process.stderr.write("[oh-my-memory] Missing value for --config\n");
    return 1;
  }

  const result = readConfigWithMeta(configPath);
  process.stdout.write(
    `${JSON.stringify({
      sources: result.sources,
      config: result.config,
    }, null, 2)}\n`,
  );
  return 0;
}
