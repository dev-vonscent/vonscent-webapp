/**
 * Локал script-д `import "server-only"`-г хоосон модуль болгоно (Next-ийн
 * гадна тэр багц суугаагүй). Зөвхөн preload-оор:
 *
 *   node --import ./scripts/stub-server-only.mjs --import tsx scripts/x.ts
 */
import Module from "node:module";
import { fileURLToPath } from "node:url";

const self = fileURLToPath(import.meta.url);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return self;
  return resolve.call(this, request, ...rest);
};
