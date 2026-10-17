import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "apps/mobile/**",
      "services/**",
      "infra/**",
    ],
  },
];

export default config;
