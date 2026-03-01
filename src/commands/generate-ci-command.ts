import { resolve } from "node:path";

import { ensureDir, writeText } from "../shared/file-utils";

const workflow = `name: oh-my-memory-ci-example

on:
  push:
  pull_request:

jobs:
  instrumented-test:
    runs-on: ubuntu-latest
    env:
      OH_MY_MEMORY_CREATE_ISSUE: "false"
    permissions:
      issues: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - run: bun install

      - name: Pre-test hook
        run: bunx oh-my-memory hook --config configs/ci.json --stage pre-test -- bun run typecheck

      - name: During-test hook
        run: bunx oh-my-memory hook --config configs/ci.json --stage during-test -- bun test

      - name: Post-test hook
        if: always()
        run: bunx oh-my-memory hook --config configs/ci.json --stage post-test -- bun run build

      - name: Resolve latest report path
        if: always()
        id: latest_report
        run: |
          if [ -f .oh-my-memory/latest-report-path.txt ]; then
            REPORT_PATH=$(cat .oh-my-memory/latest-report-path.txt)
            REPORT_PATH=$(echo "$REPORT_PATH" | tr -d '\\r\\n')
            echo "path=$REPORT_PATH" >> "$GITHUB_OUTPUT"
          else
            echo "path=" >> "$GITHUB_OUTPUT"
          fi

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: oh-my-memory-artifacts
          path: .oh-my-memory
          retention-days: 14

      - name: Emit issue template from latest report
        if: failure() && steps.latest_report.outputs.path != ''
        run: bunx oh-my-memory emit-github-assets --report "\${{ steps.latest_report.outputs.path }}"

      - name: Optional auto-create GitHub issue
        if: failure() && steps.latest_report.outputs.path != '' && env.OH_MY_MEMORY_CREATE_ISSUE == 'true'
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: bunx oh-my-memory emit-github-assets --report "\${{ steps.latest_report.outputs.path }}" --create-issue
`;

export async function executeGenerateCiCommand(args: string[]): Promise<number> {
  const outDirArgIndex = args.indexOf("--out");
  const outFile =
    outDirArgIndex >= 0 ? args[outDirArgIndex + 1] : "examples/github-actions-oh-my-memory.yml";

  const absolute = resolve(process.cwd(), outFile);
  await ensureDir(resolve(absolute, ".."));
  await writeText(absolute, workflow);
  process.stdout.write(`ci_template=${absolute}\n`);
  return 0;
}
