import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: {},
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    // Garante que o linter vai procurar nas pastas corretas do seu projeto
    files: ["**/*.{js,jsx,ts,tsx}"],
  },
];

export default eslintConfig;