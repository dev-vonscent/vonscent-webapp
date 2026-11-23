import { describe, expect, it } from "vitest";
import { emailAssetUrl } from "./asset-url";

const site = "https://dev.vonscent.mn/";

describe("emailAssetUrl", () => {
  it("returns the plain URL when no bypass secret is set", () => {
    expect(emailAssetUrl(site, "/api/gift-cards/t/image", {})).toBe(
      "https://dev.vonscent.mn/api/gift-cards/t/image",
    );
  });

  it("appends the Vercel protection bypass on preview deployments", () => {
    expect(
      emailAssetUrl(site, "api/gift-cards/t/qr", {
        VERCEL_ENV: "preview",
        VERCEL_AUTOMATION_BYPASS_SECRET: "s3cr/t",
      }),
    ).toBe(
      "https://dev.vonscent.mn/api/gift-cards/t/qr?x-vercel-protection-bypass=s3cr%2Ft",
    );
  });

  it("never leaks the secret into production emails", () => {
    expect(
      emailAssetUrl("https://vonscent.mn", "/api/gift-cards/t/image", {
        VERCEL_ENV: "production",
        VERCEL_AUTOMATION_BYPASS_SECRET: "secret",
      }),
    ).toBe("https://vonscent.mn/api/gift-cards/t/image");
  });

  it("uses & when the path already has a query", () => {
    expect(
      emailAssetUrl(site, "/x?a=1", { VERCEL_AUTOMATION_BYPASS_SECRET: "s" }),
    ).toBe("https://dev.vonscent.mn/x?a=1&x-vercel-protection-bypass=s");
  });
});
