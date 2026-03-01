import { resolve } from "node:path";

import { ensureDir, writeText } from "../shared/file-utils";

const githubWorkflow = `name: oh-my-memory-ci-example

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

const gitlabWorkflow = `stages:
  - test

oh_my_memory:
  stage: test
  image: oven/bun:latest
  script:
    - bun install
    - bunx oh-my-memory hook --config configs/ci.json --stage pre-test -- bun run typecheck
    - bunx oh-my-memory hook --config configs/ci.json --stage during-test -- bun test
    - bunx oh-my-memory hook --config configs/ci.json --stage post-test -- bun run build
    - bunx oh-my-memory aggregate --config configs/ci.json
  artifacts:
    when: always
    paths:
      - .oh-my-memory/
    expire_in: 14 days
`;

const circleCiWorkflow = `version: 2.1

jobs:
  oh-my-memory:
    docker:
      - image: cimg/base:stable
    steps:
      - checkout
      - run: curl -fsSL https://bun.sh/install | bash
      - run: echo 'export PATH="$HOME/.bun/bin:$PATH"' >> "$BASH_ENV"
      - run: source "$BASH_ENV" && bun install
      - run: source "$BASH_ENV" && bunx oh-my-memory hook --config configs/ci.json --stage pre-test -- bun run typecheck
      - run: source "$BASH_ENV" && bunx oh-my-memory hook --config configs/ci.json --stage during-test -- bun test
      - run: source "$BASH_ENV" && bunx oh-my-memory hook --config configs/ci.json --stage post-test -- bun run build
      - run: source "$BASH_ENV" && bunx oh-my-memory aggregate --config configs/ci.json
      - store_artifacts:
          path: .oh-my-memory

workflows:
  version: 2
  main:
    jobs:
      - oh-my-memory
`;

const azureWorkflow = `trigger:
  - main

pool:
  vmImage: ubuntu-latest

steps:
  - checkout: self
  - script: |
      curl -fsSL https://bun.sh/install | bash
      echo "##vso[task.prependpath]$HOME/.bun/bin"
    displayName: Install Bun

  - script: bun install
    displayName: Install dependencies

  - script: bunx oh-my-memory hook --config configs/ci.json --stage pre-test -- bun run typecheck
    displayName: Pre-test hook

  - script: bunx oh-my-memory hook --config configs/ci.json --stage during-test -- bun test
    displayName: During-test hook

  - script: bunx oh-my-memory hook --config configs/ci.json --stage post-test -- bun run build
    displayName: Post-test hook
    condition: always()

  - script: bunx oh-my-memory aggregate --config configs/ci.json
    displayName: Aggregate reports
    condition: always()

  - task: PublishBuildArtifacts@1
    displayName: Publish oh-my-memory artifacts
    condition: always()
    inputs:
      PathtoPublish: .oh-my-memory
      ArtifactName: oh-my-memory
`;

const shellWorkflow = `#!/usr/bin/env bash
set -euo pipefail

bun install
bunx oh-my-memory hook --config configs/ci.json --stage pre-test -- bun run typecheck
bunx oh-my-memory hook --config configs/ci.json --stage during-test -- bun test
bunx oh-my-memory hook --config configs/ci.json --stage post-test -- bun run build
bunx oh-my-memory aggregate --config configs/ci.json

echo "Artifacts generated in .oh-my-memory/"
`;

type CiProvider = "github" | "gitlab" | "circleci" | "azure" | "shell";

function providerTemplate(provider: CiProvider): string {
  switch (provider) {
    case "github":
      return githubWorkflow;
    case "gitlab":
      return gitlabWorkflow;
    case "circleci":
      return circleCiWorkflow;
    case "azure":
      return azureWorkflow;
    case "shell":
      return shellWorkflow;
    default:
      return githubWorkflow;
  }
}

function defaultOutputPath(provider: CiProvider): string {
  switch (provider) {
    case "github":
      return "examples/github-actions-oh-my-memory.yml";
    case "gitlab":
      return "examples/gitlab-ci-oh-my-memory.yml";
    case "circleci":
      return "examples/circleci-oh-my-memory.yml";
    case "azure":
      return "examples/azure-pipelines-oh-my-memory.yml";
    case "shell":
      return "examples/ci-oh-my-memory.sh";
    default:
      return "examples/github-actions-oh-my-memory.yml";
  }
}

function parseProvider(args: string[]): CiProvider {
  const providerIndex = args.indexOf("--provider");
  const raw = providerIndex >= 0 ? args[providerIndex + 1] : undefined;
  if (!raw) return "github";
  if (raw === "github" || raw === "gitlab" || raw === "circleci" || raw === "azure" || raw === "shell") {
    return raw;
  }
  throw new Error("Invalid --provider. Use one of: github, gitlab, circleci, azure, shell");
}

export async function executeGenerateCiCommand(args: string[]): Promise<number> {
  let provider: CiProvider;
  try {
    provider = parseProvider(args);
  } catch (error) {
    process.stderr.write(`[oh-my-memory] ${String(error)}\n`);
    return 1;
  }

  const outDirArgIndex = args.indexOf("--out");
  const outFile = outDirArgIndex >= 0 ? args[outDirArgIndex + 1] : defaultOutputPath(provider);

  if (!outFile) {
    process.stderr.write("[oh-my-memory] Missing value for --out\n");
    return 1;
  }

  const absolute = resolve(process.cwd(), outFile);
  await ensureDir(resolve(absolute, ".."));
  await writeText(absolute, providerTemplate(provider));
  process.stdout.write(`ci_template=${absolute}\n`);
  process.stdout.write(`ci_provider=${provider}\n`);
  return 0;
}
