import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig({
  extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  files: ["**/*.{js,ts}"],
  ignores: ["dist/", "node_modules/", "coverage/"],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname
    },
  },
  rules: {
    "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }]
  }
});
