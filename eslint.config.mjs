import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Synced/vendored Open Mirror chrome — owned + linted in the hub repo,
    // never edited here (see CLAUDE.md).
    "src/app/OpenMirrorNav.tsx",
    "src/app/OpenMirrorFooter.tsx",
    "src/app/OpenMirrorTheme.tsx",
  ]),
]);

export default eslintConfig;
