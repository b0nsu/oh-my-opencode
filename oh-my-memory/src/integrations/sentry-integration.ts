import { writeJson } from "../shared/file-utils";
import type { RunReport } from "../types";

interface ParsedDsn {
  endpoint: string;
  key: string;
}

function parseDsn(dsn: string): ParsedDsn | undefined {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split("/").filter(Boolean).pop();
    if (!projectId) return undefined;
    const key = url.username;
    const endpoint = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    return { endpoint, key };
  } catch {
    return undefined;
  }
}

export async function emitSentryEventIfConfigured(args: {
  dsn?: string;
  report: RunReport;
  eventFilePath: string;
}): Promise<{ attempted: boolean; delivered: boolean; reason?: string }> {
  const { dsn, report, eventFilePath } = args;
  if (!dsn || report.status === "success") {
    return { attempted: false, delivered: false, reason: "disabled_or_success" };
  }

  const parsed = parseDsn(dsn);
  if (!parsed) {
    return { attempted: true, delivered: false, reason: "invalid_dsn" };
  }

  const payload = {
    message: `oh-my-memory ${report.summary.event}`,
    level:
      report.summary.severity === "critical"
        ? "fatal"
        : report.summary.severity === "high"
          ? "error"
          : "warning",
    tags: {
      run_id: report.runId,
      stage: report.stage,
      ci: String(report.ci),
    },
    extra: {
      summary: report.summary,
      findings: report.findings,
      exitCode: report.exitCode,
    },
  };

  await writeJson(eventFilePath, payload);

  try {
    const response = await fetch(parsed.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=oh-my-memory/0.1.0`,
      },
      body: JSON.stringify(payload),
    });

    return {
      attempted: true,
      delivered: response.ok,
      reason: response.ok ? "ok" : `http_${response.status}`,
    };
  } catch {
    return { attempted: true, delivered: false, reason: "network_error" };
  }
}
