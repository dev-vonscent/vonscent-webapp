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
