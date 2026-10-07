import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next 16 ships native flat configs, so the FlatCompat shim
// (`compat.extends("next/core-web-vitals", "next/typescript")`) is gone — it
// crashes on the new config objects. Same two rule sets, imported directly.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next 16 pulls in eslint-plugin-react-hooks 7, whose
    // recommended set adds React-Compiler-oriented rules as ERRORS. On the
    // Next 16 upgrade (#681) they flagged 45 long-standing patterns (43
    // set-state-in-effect, 2 refs) that work today. Rewriting 45 effects inside
    // a framework-major PR would make it un-bisectable, so they are warnings for
    // now — still visible in `npm run lint` — and get cleaned up separately.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
    "src/types/api.gen.ts", // auto-generated from the backend OpenAPI schema
  ]),
]);

export default eslintConfig;
