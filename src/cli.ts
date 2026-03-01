import { executeAggregateCommand } from "./commands/aggregate-command";
import { executeDoctorCommand } from "./commands/doctor-command";
import { executeGenerateCiCommand } from "./commands/generate-ci-command";
import { executeGitHubAssetsCommand } from "./commands/github-assets-command";
import { executeInitCommand } from "./commands/init-command";
import { executeMigrateConfigCommand } from "./commands/migrate-config-command";
import { executePrintConfigCommand } from "./commands/print-config-command";
import { executeRunCommand } from "./commands/run-command";

function printHelp(): void {
  process.stdout.write(
    [
      "oh-my-memory",
      "",
      "Commands:",
      "  run --stage <pre-test|during-test|post-test|build|custom> -- <cmd>",
      "  hook --stage <pre-test|during-test|post-test|build|custom> -- <cmd>",
      "  aggregate [--out-dir <path>]",
      "  emit-github-assets --report <report.json> [--create-issue]",
      "  generate-ci [--provider github|gitlab|circleci|azure|shell] [--out <path>]",
      "  doctor [--config <path>]",
      "  init [--out <path>]",
      "  print-config [--config <path>]",
      "  migrate-config --config <path> [--out <path>]",
      "",
      "Examples:",
      "  oh-my-memory hook --stage pre-test -- bun run typecheck",
      "  oh-my-memory hook --stage during-test -- bun test",
      "  oh-my-memory hook --stage post-test -- bun run build",
    ].join("\n"),
  );
}

async function main(): Promise<number> {
  const [command = "help", ...rest] = process.argv.slice(2);

  if (command === "run" || command === "hook") {
    return executeRunCommand(rest);
  }

  if (command === "aggregate") {
    return executeAggregateCommand(rest);
  }

  if (command === "emit-github-assets") {
    return executeGitHubAssetsCommand(rest);
  }

  if (command === "generate-ci") {
    return executeGenerateCiCommand(rest);
  }

  if (command === "doctor") {
    return executeDoctorCommand(rest);
  }

  if (command === "init") {
    return executeInitCommand(rest);
  }

  if (command === "print-config") {
    return executePrintConfigCommand(rest);
  }

  if (command === "migrate-config") {
    return executeMigrateConfigCommand(rest);
  }

  printHelp();
  return command === "help" ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    process.stderr.write(`[oh-my-memory] ${String(error)}\n`);
    process.exitCode = 1;
  });
