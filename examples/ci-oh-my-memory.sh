#!/usr/bin/env bash
set -euo pipefail

bun install
bunx oh-my-memory hook --config configs/ci.json --stage pre-test -- bun run typecheck
bunx oh-my-memory hook --config configs/ci.json --stage during-test -- bun test
bunx oh-my-memory hook --config configs/ci.json --stage post-test -- bun run build
bunx oh-my-memory aggregate --config configs/ci.json

echo "Artifacts generated in .oh-my-memory/"
