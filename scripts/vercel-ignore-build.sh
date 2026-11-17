#!/usr/bin/env bash
# Vercel «Ignored Build Step» (vercel.json → ignoreCommand).
#   exit 0 = build-ийг АЛГАСНА, exit 1 = build ХИЙНЭ (Vercel-ийн дүрэм).
#
# Build хийх тохиолдол:
#   - production (main);
#   - `dev` branch — клиент preview дээр туршдаг;
#   - нээлттэй PR-тай branch (VERCEL_GIT_PULL_REQUEST_ID хоосон биш).
# Бусад branch-ийн push бүр preview build-ийн CPU зарцуулдаг тул алгасна.
#
# VERCEL_TARGET_ENV-ийг VERCEL_ENV-ээс түрүүлж уншина: custom environment
# (staging г.м.) дээр VERCEL_ENV нь "preview" байдаг. Мэдээлэл дутуу бол
# (CLI deploy, git ref байхгүй) аюулгүй тал руу — build хийнэ.
# PR нээхээс өмнө push хийсэн commit preview авахгүй: PR нээсний дараа
# дахин push хийнэ үү. https://vercel.com/kb/guide/how-reduce-build-costs
#
# Шаардлага: Project Settings → Environment Variables → «Automatically
# expose System Environment Variables» асаалттай байх.

target="${VERCEL_TARGET_ENV:-${VERCEL_ENV:-}}"
ref="${VERCEL_GIT_COMMIT_REF:-}"
pr="${VERCEL_GIT_PULL_REQUEST_ID:-}"

if [ "$target" = "production" ]; then
  echo "✅ production — build хийнэ"
  exit 1
fi

if [ -z "$ref" ]; then
  echo "✅ git ref мэдэгдэхгүй (CLI deploy?) — build хийнэ"
  exit 1
fi

case "$ref" in
  main | dev)
    echo "✅ $ref branch — build хийнэ"
    exit 1
    ;;
esac

if [ -n "$pr" ]; then
  echo "✅ PR #$pr ($ref) — build хийнэ"
  exit 1
fi

echo "🛑 $ref: PR-гүй branch — preview build алгасна"
exit 0
