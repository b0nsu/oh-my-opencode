import { emitCiArtifactHint, emitGitHubIssueAssets } from "../integrations/github-assets";
import { existsSync } from "node:fs";

export async function executeGitHubAssetsCommand(args: string[]): Promise<number> {
  let reportPath: string | undefined;
  let createIssue = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--report") reportPath = args[i + 1];
    if (args[i] === "--create-issue") createIssue = true;
  }

  if (!reportPath) {
    process.stderr.write("[oh-my-memory] Missing --report path\n");
    process.stderr.write("Usage: oh-my-memory emit-github-assets --report <report.json> [--create-issue]\n");
    return 1;
  }

  if (!existsSync(reportPath)) {
    process.stderr.write(`[oh-my-memory] Report file not found: ${reportPath}\n`);
    return 1;
  }

  const result = await emitGitHubIssueAssets({ reportPath, createIssue });
  process.stdout.write(`issue_template=${result.issueTemplatePath}\n`);
  process.stdout.write(`created_issue=${result.createdIssue}\n`);
  process.stdout.write("artifact_upload_hint:\n");
  process.stdout.write(`${emitCiArtifactHint(reportPath)}\n`);
  return 0;
}
