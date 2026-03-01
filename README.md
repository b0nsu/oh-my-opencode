# oh-my-memory

<div align="center">

**Runtime observability for builds, tests, and crashes.**  
**Constellation-themed telemetry for local and CI pipelines.**

[![runtime-bun](https://img.shields.io/badge/runtime-bun-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![language-typescript](https://img.shields.io/badge/language-typescript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
![license-mit](https://img.shields.io/badge/license-MIT-2ea44f?style=flat-square)
[![theme-constellation](https://img.shields.io/badge/theme-constellation-1f2a44?style=flat-square)](#constellation-map)

```text
       *        .            *
  .         *       .
        .        *       .
   *         .        *

      o h - m y - m e m o r y
     constellation telemetry
```

</div>

> [!NOTE]
> `oh-my-memory` wraps your existing build/test command and records runtime resources, crash artifacts, and baseline analysis into JSON + Markdown reports.

## Constellation Map

| Constellation | Responsibility |
| :-- | :-- |
| Orion | Hook stages (`pre-test`, `during-test`, `post-test`, `build`, `custom`) |
| Lyra | Runtime sampler (RSS/VSZ, CPU, I/O, thread/process tree) |
| Perseus | Crash capture (core/minidump + symbol artifacts) |
| Cassiopeia | Automatic analysis (stack, hot modules, leak/overflow signals) |
| Andromeda | Report emitters (`report.json`, `report.md`) |
| Polaris | CI integration (artifact hints + GitHub issue template flow) |
| Nebula | Aggregation (`aggregate.json`, `aggregate.md`) |
| Kepler | Container awareness (Docker/Kubernetes, cgroup memory hint) |

## Quick Start

```bash
bun install
bun run build

# health check
bun run src/cli.ts doctor --config configs/local.json

# run hooks around your pipeline
bun run src/cli.ts hook --config configs/local.json --stage pre-test -- bun run typecheck
bun run src/cli.ts hook --config configs/local.json --stage during-test -- bun test
bun run src/cli.ts hook --config configs/local.json --stage post-test -- bun run build
```

Reports are written under `.oh-my-memory/runs/<run_id>/`.

## Command Deck

- `bun run src/cli.ts run --stage <stage> -- <command...>`
- `bun run src/cli.ts hook --stage <stage> -- <command...>`
- `bun run src/cli.ts aggregate [--out-dir .oh-my-memory]`
- `bun run src/cli.ts emit-github-assets --report <report.json> [--create-issue]`
- `bun run src/cli.ts generate-ci [--provider github|gitlab|circleci|azure|shell] [--out <path>]`
- `bun run src/cli.ts doctor [--config <path>]`
- `bun run src/cli.ts init [--out .oh-my-memory.config.jsonc]`
- `bun run src/cli.ts print-config [--config <path>]`
- `bun run src/cli.ts migrate-config --config <path> [--out <path>]`

## CI Orbit

Workflow templates:

- `examples/github-actions-oh-my-memory.yml`
- `examples/gitlab-ci-oh-my-memory.yml`
- `examples/circleci-oh-my-memory.yml`
- `examples/azure-pipelines-oh-my-memory.yml`
- `examples/ci-oh-my-memory.sh`

```bash
# regenerate GitHub Actions workflow
bun run src/cli.ts generate-ci --provider github

# generate GitLab CI workflow
bun run src/cli.ts generate-ci --provider gitlab
```

The template runs hook stages with `configs/ci.json`, uploads artifacts on failure, and emits an issue template from the latest report.

### CI toggles

- `OH_MY_MEMORY_CREATE_ISSUE="true"` enables automatic issue creation.
- Keep issue auto-create branch-gated (for example, `dev`) to avoid noise.
- `OH_MY_MEMORY_SENTRY_DSN` can be injected as a secret for optional Sentry forwarding.

## Crash + Symbol Capture

Default crash patterns:

- `core`
- `core.*`
- `*.dmp`
- `*.mdmp`
- `*.stackdump`

Default symbol globs:

- `dist/**/*.map`
- `dist/**/*.dSYM`
- `build/**/*.pdb`

Artifacts are copied into:

- `artifacts/crash/`
- `artifacts/crash/symbols/`

## Container Flight

- Docker agent: `docker/Dockerfile.agent`, `docker/entrypoint.sh`
- Kubernetes example: `examples/kubernetes-job.yaml`

## Configuration

```json
{
  "configVersion": "1.0.0",
  "outDir": ".oh-my-memory",
  "sampleIntervalMs": 250,
  "maxSamples": 2000,
  "logTailBytes": 65536,
  "maxArtifactBytes": 1073741824,
  "crashPatterns": ["core", "core.*", "*.dmp", "*.mdmp", "*.stackdump"],
  "symbolGlobs": ["dist/**/*.map", "dist/**/*.dSYM", "build/**/*.pdb"],
  "baselineFile": ".oh-my-memory/baseline.json",
  "baselineThresholds": {
    "regressionRssBytes": 134217728,
    "regressionDurationMs": 15000,
    "improvementRssBytes": 67108864,
    "improvementDurationMs": 5000
  },
  "sentryDsnEnv": "OH_MY_MEMORY_SENTRY_DSN",
  "redaction": {
    "enabled": true,
    "replacement": "[REDACTED]"
  }
}
```

Environment profiles:

- `configs/local.json` for local development
- `configs/ci.json` for CI thresholds and stricter sampling

## Real Smoke Test

```bash
bun run src/cli.ts hook --config configs/local.json --stage custom -- bun --version
bun run src/cli.ts aggregate --out-dir .oh-my-memory
```

You should see:

- a new run folder under `.oh-my-memory/runs/`
- `report.json` and `report.md`
- aggregate outputs in `.oh-my-memory/aggregate.json` and `.oh-my-memory/aggregate.md`
