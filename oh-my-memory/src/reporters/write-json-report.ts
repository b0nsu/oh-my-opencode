import { join } from "node:path";

import { writeJson } from "../shared/file-utils";
import type { RunReport } from "../types";

export async function writeJsonReport(runDir: string, report: RunReport): Promise<string> {
  const path = join(runDir, "report.json");
  await writeJson(path, report);
  return path;
}
