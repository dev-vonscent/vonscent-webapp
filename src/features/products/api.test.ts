import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Supabase тохируулагдсан үед уншилтын алдаа ШИДЭГДЭХ ёстой — seed/санах ойн
 * зам, хоосон жагсаалт, `null` (→ 404) руу шилжвэл ISR болон `unstable_cache`
 * тэр буруу хариуг нэг цагийн турш хадгална (Sentry JAVASCRIPT-NEXTJS-Q, -E).
 * Санах ойн зам зөвхөн DEMO горимд (env хоосон).
 */

type Result = { data: unknown; error: { message: string } | null };

/** Chainable query builder: every call returns itself; awaiting yields `result`. */
function query(result: Result) {
  const builder: Record<string, unknown> = {};
  const self = new Proxy(builder, {
    get(_, prop) {
      if (prop === "then") {
        return (resolve: (r: Result) => unknown) => resolve(result);
      }
      return () => self;
    },
  });
  return self;
}

const DB_DOWN: Result = { data: null, error: { message: "Project not specified" } };

let tables: Record<string, Result>;
let rpcs: Record<string, Result>;

async function load(configured: boolean) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {},
    isSupabaseConfigured: configured,
  }));
  vi.doMock("next/cache", () => ({
    unstable_cache: <T>(fn: T) => fn,
  }));
  vi.doMock("@/lib/supabase/public", () => ({
    createPublicClient: () =>
      configured
        ? {
            from: (t: string) => query(tables[t] ?? { data: [], error: null }),
            rpc: (fn: string) => query(rpcs[fn] ?? { data: [], error: null }),
          }
        : null,
  }));
  vi.doMock("@/lib/supabase/rpc", () => ({
    callRpc: async (_c: unknown, fn: string) =>
      rpcs[fn] ?? { data: [], error: null },
  }));
  const api = await import("./api");
  const { SEED_PRODUCTS } = await import("./seed");
  return { ...api, SEED_PRODUCTS };
}

beforeEach(() => {
  tables = {};
  rpcs = {};
});

describe("Supabase configured: read errors throw, never fall back", () => {
  it("getCatalog rethrows a catalog_search failure", async () => {
    rpcs.catalog_search = DB_DOWN;
    const { getCatalog } = await load(true);
    await expect(getCatalog({})).rejects.toThrow(
      "catalog_search failed: Project not specified",
    );
  });

  it("getRelated rethrows a related_products failure", async () => {
    rpcs.related_products = DB_DOWN;
    const { getRelated } = await load(true);
    await expect(getRelated("dior-sauvage")).rejects.toThrow(
      "related_products failed",
    );
  });

  it("a product lookup error throws instead of returning null (cached 404)", async () => {
    tables.products = DB_DOWN;
    const { getProductPageBySlug } = await load(true);
    await expect(getProductPageBySlug("dior-sauvage")).rejects.toThrow(
      "product by slug failed",
    );
  });

  it("a product that truly isn't there is still null", async () => {
    tables.products = { data: null, error: null };
    const { getProductPageBySlug } = await load(true);
    await expect(getProductPageBySlug("nope")).resolves.toBeNull();
  });

  it("the full product list throws instead of an empty catalogue", async () => {
    tables.products = DB_DOWN;
    const { fetchProducts } = await load(true);
    await expect(fetchProducts()).rejects.toThrow("products failed");
  });

  it("facets throw instead of caching no brands / a 0₮ price range", async () => {
    rpcs.catalog_facets = DB_DOWN;
    const { getBrands } = await load(true);
    await expect(getBrands()).rejects.toThrow("catalog_facets failed");
  });

  it("coming-soon rail throws instead of disappearing for an hour", async () => {
    tables.products = DB_DOWN;
    const { getComingSoonProducts } = await load(true);
    await expect(getComingSoonProducts()).rejects.toThrow("coming soon failed");
  });

  it("best sellers throw on an RPC error", async () => {
    rpcs.top_seller_products = DB_DOWN;
    const { getBestSellers } = await load(true);
    await expect(getBestSellers()).rejects.toThrow(
      "top_seller_products failed",
    );
  });

  it("bulk product details throw by default (bundle members)", async () => {
    tables.products = DB_DOWN;
    const { getProductDetailsByIds } = await load(true);
    await expect(getProductDetailsByIds(["a"])).rejects.toThrow(
      "product details",
    );
  });

  it("returns an empty result as-is — that is a real answer, not an error", async () => {
    rpcs.catalog_search = { data: [], error: null };
    const { getCatalog } = await load(true);
    await expect(getCatalog({ search: "zzz" })).resolves.toMatchObject({
      items: [],
      total: 0,
    });
  });
});

describe("DEMO mode (no Supabase env): seed catalogue", () => {
  it("getCatalog serves seed products", async () => {
    const { getCatalog, SEED_PRODUCTS } = await load(false);
    const r = await getCatalog({ perPage: 1000 });
    expect(r.total).toBe(SEED_PRODUCTS.length);
  });

  it("getRelated ranks within the seed catalogue", async () => {
    const { getRelated, SEED_PRODUCTS } = await load(false);
    const r = await getRelated(SEED_PRODUCTS[0]!.slug, 3);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((p) => p.slug !== SEED_PRODUCTS[0]!.slug)).toBe(true);
  });
});

describe("bottle locks", () => {
  it("throw instead of caching «nothing locked» (tag-only cache, no expiry)", async () => {
    tables.bottle_stock = DB_DOWN;
    await load(true);
    const { getBottleLocks } = await import("./bottle-stock");
    await expect(getBottleLocks()).rejects.toThrow("bottle locks failed");
  });
});
