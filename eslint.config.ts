import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  {
    extends: [js.configs.recommended, tseslint.configs.strictTypeChecked],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    files: ["**/*.{js,ts}"],
    ignores: ["dist/", "node_modules/", "coverage/"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }]
    }
  }, {
    files: ["**/*.test.ts", "tests/**/*.ts"],
    rules: {
      // Relax rules for tests
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off"
  }
  }]);
