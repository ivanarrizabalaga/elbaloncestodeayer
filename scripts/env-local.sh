#!/usr/bin/env sh
# Writes .env.local with the keys of the local Supabase stack (pnpm db:start must be running).
# These are local development keys, not secrets of any real project.
set -eu
eval "$(pnpm exec supabase status -o env 2>/dev/null | grep -E '^(API_URL|PUBLISHABLE_KEY|SECRET_KEY)=')"
cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
SUPABASE_SECRET_KEY=$SECRET_KEY
ENV
echo "Wrote .env.local for the local Supabase stack."
