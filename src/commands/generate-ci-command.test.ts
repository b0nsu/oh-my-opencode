import { describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";

import { executeGenerateCiCommand } from "./generate-ci-command";

describe("executeGenerateCiCommand", () => {
  it("generates gitlab template with provider flag", async () => {
    const tempDir = mkdtempSync(join(os.tmpdir(), "oh-my-memory-ci-"));
    try {
      const out = join(tempDir, "gitlab.yml");
      const code = await executeGenerateCiCommand(["--provider", "gitlab", "--out", out]);
      expect(code).toBe(0);
      const content = readFileSync(out, "utf-8");
      expect(content.includes("stages:")).toBe(true);
      expect(content.includes("oh_my_memory:")).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("fails on invalid provider", async () => {
    const code = await executeGenerateCiCommand(["--provider", "jenkins"]);
    expect(code).toBe(1);
  });
});
