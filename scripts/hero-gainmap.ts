/**
 * Hero-гийн студийн HDR орчны зургийг gainmap JPG (UltraHDR) болгоно (#4).
 *
 *   pnpm hero:gainmap
 *
 * Эх HDR: `scripts/hero-env/*.hdr` (Blender `vial20.py --env`-ийн гаралт).
 * Гаралт: `public/models/<нэр>.jpg` — drei `<Environment files="*.jpg">` нь
 * `HDRJPGLoader`-оор уншдаг. RGBE `.hdr` нь gzip-гүй ~0.7–0.9MB татагддаг
 * (Lighthouse, 2026-10-10), gainmap JPG нь нэг SDR JPG + gain map + metadata.
 *
 * Encoder (`@monogrid/gainmap-js/encode`) WebGL шаарддаг тул Playwright-ийн
 * Chromium дотор ажиллана: жижиг статик сервер three / gainmap-js /
 * эх HDR-ийг import map-аар өгнө. Дараа нь `pnpm hero:assets` (URL hash).
 */
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import type { AddressInfo } from "node:net";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, "scripts/hero-env");
const OUT_DIR = path.join(ROOT, "public/models");
/** SDR давхаргын JPEG чанар — gain map нь гэрлийн мужийг сэргээнэ. */
const QUALITY = 0.92;

const MOUNTS: Record<string, string> = {
  "/three/": path.join(ROOT, "node_modules/three/"),
  "/gainmap/": path.join(ROOT, "node_modules/@monogrid/gainmap-js/dist/"),
  "/env/": SRC_DIR + "/",
};

const PAGE = `<!doctype html><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/":"/three/"}}</script>
<script type="module">
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { encodeAndCompress, findTextureMinMax } from "/gainmap/encode.js";
import { encodeJPEGMetadata } from "/gainmap/libultrahdr.js";
window.encodeHdr = async (file, quality) => {
  const image = await new HDRLoader().loadAsync("/env/" + file);
  const max = findTextureMinMax(image);
  const res = await encodeAndCompress({
    image,
    maxContentBoost: Math.max(...max),
    mimeType: "image/jpeg",
    quality,
    // HDRLoader-ийн текстур flipY=true тул render target-ээс уншсан пиксел
    // доошоо харсан гардаг — эс бөгөөс сав шалны оронд таазыг тусгана.
    flipY: true,
  });
  const jpeg = encodeJPEGMetadata({ ...res, sdr: res.sdr, gainMap: res.gainMap });
  let s = "";
  for (let i = 0; i < jpeg.length; i += 0x8000)
    s += String.fromCharCode(...jpeg.subarray(i, i + 0x8000));
  return { b64: btoa(s), w: res.sdr.width, h: res.sdr.height, max: Math.max(...max) };
};
window.ready = true;
</script>`;

const TYPES: Record<string, string> = {
  ".js": "text/javascript",
  ".hdr": "application/octet-stream",
};

function serve(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (url === "/") {
    res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
    return;
  }
  const mount = Object.keys(MOUNTS).find((m) => url.startsWith(m));
  const file = mount && path.join(MOUNTS[mount], url.slice(mount.length));
  if (!file || !file.startsWith(MOUNTS[mount!]) || !fs.existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res
    .writeHead(200, {
      "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
    })
    .end(fs.readFileSync(file));
}

async function main() {
  const sources = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith(".hdr"));
  if (!sources.length) throw new Error(`HDR алга: ${SRC_DIR}`);

  const server = http.createServer(serve);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  const browser = await chromium.launch({
    args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("[page]", e.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => (window as { ready?: boolean }).ready);
    for (const file of sources) {
      const out = await page.evaluate(
        ([f, q]) =>
          (
            window as unknown as {
              encodeHdr: (
                f: string,
                q: number,
              ) => Promise<{ b64: string; w: number; h: number; max: number }>;
            }
          ).encodeHdr(f, q),
        [file, QUALITY] as const,
      );
      const buf = Buffer.from(out.b64, "base64");
      const dest = path.join(OUT_DIR, file.replace(/\.hdr$/, ".jpg"));
      fs.writeFileSync(dest, buf);
      const before = fs.statSync(path.join(SRC_DIR, file)).size;
      console.log(
        `· ${file} ${Math.round(before / 1024)}KB → ${path.basename(dest)} ` +
          `${Math.round(buf.length / 1024)}KB (${out.w}×${out.h}, max ${out.max.toFixed(1)})`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
