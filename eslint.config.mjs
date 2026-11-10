import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "node_modules/**", "tooling/**", ".data/**", "docs/**"]),
  {
    rules: {
      // Fetch-on-mount is the store screens' data load. The kiosk rebuild
      // replaces these effects; the rule flags the await-free call itself.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
