#!/usr/bin/env sh
# Writes the local Supabase keys into .env.local (pnpm db:start must be running).
# These are local development keys, not secrets of any real project.
# Only these three lines are replaced: anything else in .env.local (e.g. the R2 dev bucket) is kept.
set -eu
eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"

touch .env.local
others="$(grep -vE '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SECRET_KEY)=' .env.local || true)"
{
  echo "NEXT_PUBLIC_SUPABASE_URL=$API_URL"
  echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY"
  echo "SUPABASE_SECRET_KEY=$SECRET_KEY"
  [ -n "$others" ] && printf '%s\n' "$others"
} > .env.local.tmp
mv .env.local.tmp .env.local
echo "Updated the Supabase keys in .env.local (other variables kept)."
