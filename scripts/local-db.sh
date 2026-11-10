#!/bin/sh
# Локал Supabase (Docker) — migration ба SQL тестийг dev/prod санд хүргэлгүй
# туршихад. Хуваалцсан dev санд бусад инженерийн migration-тай зөрчилдөхгүй.
#
#   pnpm db:local start    # stack асаах (127.0.0.1:54322, Studio :54323)
#   pnpm db:local stop     # зогсоох (өгөгдөл үлдэнэ)
#   pnpm db:local reset    # өгөгдлийг устгаж дахин асаах → db:migrate-local
#
# Supabase CLI нь ажлын хавтасны `.env.local`-ийг уншдаг (манайх .env.dev
# руу symlink, CLI-ийн parser-т тохирохгүй мөртэй байж болно) ба
# `supabase/migrations`-ийг өөрөө ажиллуулдаг (0028a_ мэт нэрийг алгасна).
# Тиймээс .env-гүй, migration-гүй тусдаа хавтаснаас асааж, migration-ыг
# манай `scripts/migrate.ts` (`pnpm db:migrate-local`) хийнэ.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK="$ROOT/.local-supabase"
mkdir -p "$WORK/supabase/migrations"
cp "$ROOT/supabase/config.toml" "$WORK/supabase/config.toml"
if [ ! -f "$ROOT/.env.localdb" ]; then
  printf '%s\n' '# Локал Supabase (pnpm db:local start)' \
    'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres' \
    'CRON_SECRET=local-cron-secret' \
    'EMAIL_MAILPIT_URL=http://127.0.0.1:54324' \
    > "$ROOT/.env.localdb"
fi
cd "$WORK"
case "${1:-start}" in
  start) supabase start ;;
  stop) supabase stop ;;
  reset) supabase stop --no-backup && supabase start ;;
  status) supabase status ;;
  *) echo "usage: local-db.sh start|stop|reset|status" >&2; exit 1 ;;
esac
