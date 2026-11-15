#!/bin/sh
# Database backup in the three files Supabase's restore guide expects: roles, schema, data.
#
#   sh scripts/backup.sh <out-dir>
#
# Dumps the local database, or the one in SUPABASE_DB_URL if set (the weekly GitHub Action,
# see .github/workflows/backup.yml). The output contains real data: never commit it.
#
# Left out of the data: sessions and one-time tokens (a backup must not be a way in, and
# nobody needs them after a restore) and the auth audit log.
set -eu

out="$1"
mkdir -p "$out"

if [ -n "${SUPABASE_DB_URL:-}" ]; then
  set -- --remote="$SUPABASE_DB_URL"
else
  set --
fi

exclude="auth.sessions,auth.refresh_tokens,auth.one_time_tokens,auth.flow_state,auth.audit_log_entries,auth.mfa_challenges"

pnpm exec supabase db dump "$@" --role-only -f "$out/roles.sql"
pnpm exec supabase db dump "$@" -f "$out/schema.sql"
pnpm exec supabase db dump "$@" --data-only --use-copy -x "$exclude" -f "$out/data.sql"
