import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";
import { readFile } from "node:fs/promises";

import { ensureDir, writeText } from "../shared/file-utils";
import type { RunReport } from "../types";

function issueFingerprint(report: RunReport): string {
  const firstFinding = report.findings[0]?.title ?? "no-finding";
  return `${report.stage}|${report.summary.severity}|${firstFinding}`;
}

function issueTitle(report: RunReport): string {
  return `[oh-my-memory] ${report.summary.severity.toUpperCase()} ${report.summary.event} (${report.stage})`;
}

function hasExistingOpenIssue(report: RunReport): boolean {
  const title = issueTitle(report);
  const run = spawnSync(
    "gh",
    [
      "issue",
      "list",
      "--state",
      "open",
      "--search",
      `${title} in:title`,
      "--json",
      "number",
      "--limit",
      "1",
    ],
    { encoding: "utf-8" },
  );
  if (run.status !== 0) return false;
  try {
    const parsed = JSON.parse(run.stdout) as Array<{ number: number }>;
    return parsed.length > 0;
  } catch {
    return false;
  }
}

function issueBody(report: RunReport, reportPath: string): string {
  return [
    "## Incident Summary",
    `- Run ID: ${report.runId}`,
    `- Fingerprint: ${issueFingerprint(report)}`,
    `- Stage: ${report.stage}`,
    `- Severity: ${report.summary.severity}`,
    `- Reproduction Priority: ${report.summary.reproductionPriority}`,
    `- Exit Code: ${report.exitCode ?? "n/a"}`,
    `- Report JSON: ${reportPath}`,
    "",
    "## Recommended Actions",
    ...report.summary.recommendedActions.map((item) => `- ${item}`),
    "",
    "## Top Findings",
    ...report.findings.slice(0, 5).map((item) => `- [${item.severity}] ${item.title}`),
  ].join("\n");
}

export async function emitGitHubIssueAssets(args: {
  reportPath: string;
  createIssue: boolean;
}): Promise<{ issueTemplatePath: string; createdIssue: boolean }> {
  const raw = await readFile(args.reportPath, "utf-8");
  const report = JSON.parse(raw) as RunReport;
  const outDir = dirname(args.reportPath);

  const templateDir = join(outDir, "github");
  await ensureDir(templateDir);
  const issueTemplatePath = join(templateDir, `issue-${report.runId}.md`);
  await writeText(issueTemplatePath, issueBody(report, args.reportPath));

  if (!args.createIssue) {
    return { issueTemplatePath, createdIssue: false };
  }

  if (hasExistingOpenIssue(report)) {
    return { issueTemplatePath, createdIssue: false };
  }

  const title = issueTitle(report);
  const run = spawnSync("gh", ["issue", "create", "--title", title, "--body-file", issueTemplatePath], {
    encoding: "utf-8",
  });

  return {
    issueTemplatePath,
    createdIssue: run.status === 0,
  };
}

export function emitCiArtifactHint(reportPath: string): string {
  const reportDir = dirname(reportPath);
  return [
    "- uses: actions/upload-artifact@v4",
    "  if: failure()",
    "  with:",
    "    name: oh-my-memory-artifacts",
    `    path: ${reportDir}`,
    "    retention-days: 14",
  ].join("\n");
}

export function reportFileName(reportPath: string): string {
  return basename(reportPath);
}
