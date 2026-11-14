#!/bin/sh
# Runs a command with the production variables from .env.prod (gitignored).
# Usage: sh scripts/prod.sh <command> [args...]
set -eu

if [ ! -f .env.prod ]; then
  echo "Missing .env.prod. See .env.example and docs/infrastructure.md." >&2
  exit 1
fi

set -a
. ./.env.prod
set +a

exec "$@"
