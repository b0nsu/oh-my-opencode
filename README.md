# oh-my-memory

`oh-my-memory` is a CLI-first runtime instrumentation tool for local and CI builds.

It wraps your existing command and records:

- pre/during/post test build hook stages
- runtime resource profile (RSS/VSZ, CPU, I/O, thread/process tree)
- crash capture bundles (core/minidump + symbol artifacts)
- automatic baseline analysis (stack traces, hot modules, leak/overflow signs)
- JSON + human-readable reports
- CI helper outputs for artifact upload and issue templates
- optional aggregate stats and optional Sentry event emission
- container awareness (Docker/Kubernetes hints + cgroup memory limit)

## Install

```bash
bun install
bun run build
```

## Quick Start

```bash
# pre-test instrumentation
bun run src/cli.ts hook --config configs/local.json --stage pre-test -- bun run typecheck

# during-test instrumentation
bun run src/cli.ts hook --config configs/local.json --stage during-test -- bun test

# post-test instrumentation
bun run src/cli.ts hook --config configs/local.json --stage post-test -- bun run build
```

Outputs are written under `.oh-my-memory/runs/<run_id>/`.

## Commands

- `oh-my-memory run --stage <stage> -- <command...>`
- `oh-my-memory hook --stage <stage> -- <command...>`
- `oh-my-memory aggregate [--out-dir .oh-my-memory]`
- `oh-my-memory emit-github-assets --report <report.json> [--create-issue]`
- `oh-my-memory generate-ci [--out examples/github-actions-oh-my-memory.yml]`
- `oh-my-memory doctor`

## CI Integration (GitHub Actions)

Generate example workflow:

```bash
bun run src/cli.ts generate-ci
```

This produces a workflow snippet with pre/during/post hook stages and artifact upload on failure.

Repository-level real workflow is included at:

- `.github/workflows/oh-my-memory-ci.yml`

It runs hooks in CI with `configs/ci.json`, uploads artifacts on failure, and emits a GitHub issue template from the latest report.

Operational toggles in `.github/workflows/oh-my-memory-ci.yml`:

- `OH_MY_MEMORY_CREATE_ISSUE`: set `"true"` to allow automatic issue creation
- auto-create step is further gated to `dev` branch only

Required secret for issue creation:

- `GITHUB_TOKEN` (already available in GitHub Actions context)
- optional Sentry DSN secret mapped to env `OH_MY_MEMORY_SENTRY_DSN`

## Crash Capture and Symbols

- crash patterns default: `core`, `core.*`, `*.dmp`, `*.mdmp`, `*.stackdump`
- symbol globs default: `dist/**/*.map`, `dist/**/*.dSYM`, `build/**/*.pdb`

When failures happen, `oh-my-memory` scans and copies matching files into:

- `artifacts/crash/`
- `artifacts/crash/symbols/`

## Sentry (optional)

Set `--sentry-dsn` (or config field) to attempt a lightweight event post on failed runs.

Environment-based DSN is also supported via `sentryDsnEnv`.

- local default: `OH_MY_MEMORY_SENTRY_DSN_LOCAL`
- ci default: `OH_MY_MEMORY_SENTRY_DSN`

## Docker/Container Usage

See `docker/Dockerfile.agent` and `docker/entrypoint.sh` for agent-style container execution.

## Example Config

```json
{
  "outDir": ".oh-my-memory",
  "sampleIntervalMs": 250,
  "maxSamples": 2000,
  "logTailBytes": 65536,
  "crashPatterns": ["core", "core.*", "*.dmp", "*.mdmp", "*.stackdump"],
  "symbolGlobs": ["dist/**/*.map", "dist/**/*.dSYM", "build/**/*.pdb"],
  "baselineFile": ".oh-my-memory/baseline.json",
  "baselineThresholds": {
    "regressionRssBytes": 134217728,
    "regressionDurationMs": 15000,
    "improvementRssBytes": 67108864,
    "improvementDurationMs": 5000
  },
  "sentryDsnEnv": "OH_MY_MEMORY_SENTRY_DSN"
}
```

## Environment Tuning

- `configs/local.json`: relaxed baseline for developer machines
- `configs/ci.json`: stricter CI threshold profile
- override at runtime: `--config configs/ci.json`
