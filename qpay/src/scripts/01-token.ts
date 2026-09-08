/**
 * Step 1 — POST /v2/auth/token
 *
 * Also proves the token cache works: the second getToken() must not hit the
 * network. requirement.md explicitly asks for timestamp-based, single-shot
 * token issuance rather than one auth call per request.
 */
import { config } from "../config.js";
import { clearTokenCache, getToken, lastTokenResponse } from "../client.js";
import { dumpJson, heading, run } from "./_shared.js";

run(async () => {
  heading("1. Token авах — POST /auth/token");
  console.log(`base url : ${config.baseUrl}`);
  console.log(`client   : ${config.username}`);

  clearTokenCache();

  const first = await getToken();
  console.log(`\n✓ access_token авлаа (${first.accessToken.length} тэмдэгт)`);
  console.log(`  fromCache : ${first.fromCache}  ← сүлжээгээр авсан`);

  const raw = lastTokenResponse;
  if (raw) {
    const rawExpires = Number(raw.expires_in);
    const asTimestamp = rawExpires > 10_000_000;
    console.log(`\n  expires_in (түүхий утга) : ${rawExpires}`);
    console.log(
      `  тайлбар                  : ${
        asTimestamp
          ? "unix timestamp (секунд) — TTL БИШ"
          : "TTL (секунд)"
      }`,
    );
    console.log(
      `  бодит дуусах хугацаа     : ${new Date(first.expiresAtMs).toISOString()}`,
    );
    const minutes = Math.round((first.expiresAtMs - Date.now()) / 60_000);
    console.log(`  одооноос хойш            : ~${minutes} минут`);
  }

  const second = await getToken();
  console.log(`\n✓ Дахин дуудав — fromCache: ${second.fromCache}`);
  if (!second.fromCache) {
    console.log(
      "  ⚠ Кэш ажиллаагүй байна — expires_in-ийн боловсруулалтыг шалгана уу.",
    );
  } else {
    console.log("  Кэш зөв ажиллаж байна: сүлжээ рүү дахин хандаагүй.");
  }

  if (raw) {
    dumpJson("Түүхий token хариулт (нууц утгууд таслагдсан)", {
      ...raw,
      access_token: `${raw.access_token.slice(0, 12)}…`,
      refresh_token: `${raw.refresh_token?.slice(0, 12) ?? ""}…`,
    });
  }
});
