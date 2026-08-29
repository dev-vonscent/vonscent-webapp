import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": { entryPoint: "src/app/globals.css" },
    },
    rules: {
      // Keep Tailwind classes canonical (max-w-[88rem] → max-w-352, etc.),
      // matching the IntelliSense suggestCanonicalClasses hints. Auto-fixable.
      "better-tailwindcss/enforce-canonical-classes": [
        "warn",
        { rootFontSize: 16 },
      ],
    },
  },
  {
    // Admin writes must go through `mutate()` / `mutateJson()` / `saveSetting()`
    // from `@/features/admin/lib/mutate`, which check `res.ok` and surface a
    // toast on failure. A bare `fetch` here is how "Хадгалагдлаа ✓" ended up
    // rendering for rejected writes to shipping fees and ml inventory — twice.
    files: [
      "src/features/admin/**/*.{ts,tsx}",
      "src/app/(admin)/**/*.{ts,tsx}",
    ],
    ignores: ["src/features/admin/lib/mutate.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Админы бичилтийг @/features/admin/lib/mutate-ийн mutate() / mutateJson() / saveSetting()-ээр дамжуул — res.ok шалгаж, алдааг toast-оор харуулна.",
        },
      ],
    },
  },
  {
    rules: {
      // The `useEffect(() => setMounted(true), [])` mount guard is the
      // idiomatic way to avoid hydration mismatches with persisted client
      // stores (cart, wishlist, theme). The new react-compiler lint flags it,
      // but it is intentional and correct here.
      "react-hooks/set-state-in-effect": "off",
      // react-hook-form's watch() can't be memoized by the compiler; harmless.
      "react-hooks/incompatible-library": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "docs/**",
  ]),
]);

export default eslintConfig;
