#!/usr/bin/env sh
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: container runs: <stage> -- <command...>"
  echo "example: /entrypoint.sh during-test -- bun test"
  exit 1
fi

STAGE="$1"
shift

if [ "$1" = "--" ]; then
  shift
fi

exec bun run dist/cli.js hook --stage "$STAGE" -- "$@"
