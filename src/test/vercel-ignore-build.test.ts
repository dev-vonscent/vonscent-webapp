import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** scripts/vercel-ignore-build.sh: exit 0 = алгасах, 1 = build хийх. */
const SCRIPT = path.resolve(__dirname, "../../scripts/vercel-ignore-build.sh");

function run(env: Record<string, string>) {
  const { status } = spawnSync("bash", [SCRIPT], {
    // Vercel-ийн хувьсагч локал орчноос орж ирэхгүйн тулд зөвхөн PATH.
    env: { NODE_ENV: "test", PATH: process.env.PATH ?? "", ...env },
    encoding: "utf8",
  });
  return status === 0 ? "skip" : status === 1 ? "build" : `exit ${status}`;
}

describe("vercel-ignore-build.sh", () => {
  it("production → build", () => {
    expect(
      run({ VERCEL_TARGET_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }),
    ).toBe("build");
    // VERCEL_TARGET_ENV байхгүй хуучин орчинд VERCEL_ENV-ээр.
    expect(
      run({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" }),
    ).toBe("build");
  });

  it("main, dev branch → build", () => {
    for (const ref of ["main", "dev"]) {
      expect(
        run({ VERCEL_TARGET_ENV: "preview", VERCEL_GIT_COMMIT_REF: ref }),
      ).toBe("build");
    }
  });

  it("нээлттэй PR-тай branch → build", () => {
    expect(
      run({
        VERCEL_TARGET_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "fix/x",
        VERCEL_GIT_PULL_REQUEST_ID: "281",
      }),
    ).toBe("build");
  });

  it("PR-гүй бусад branch → алгасна", () => {
    expect(
      run({
        VERCEL_TARGET_ENV: "preview",
        VERCEL_GIT_COMMIT_REF: "feat/x",
        VERCEL_GIT_PULL_REQUEST_ID: "",
      }),
    ).toBe("skip");
    // `dev`-ээр эхэлсэн өөр branch dev биш.
    expect(
      run({ VERCEL_TARGET_ENV: "preview", VERCEL_GIT_COMMIT_REF: "dev-2" }),
    ).toBe("skip");
  });

  it("мэдээлэл дутуу (CLI deploy) → build", () => {
    expect(run({})).toBe("build");
  });
});
