/**
 * Lint rules. The important one: no visible text written straight into a
 * screen or component (docs/LANGUAGE.md). Every word goes in
 * src/i18n/en.json and es.json and is shown with t("...").
 *
 *   npm run lint
 *
 * `npm test` runs this too (__tests__/i18n.test.ts), so a hard-coded string
 * fails the tests, and the demo build runs it before building.
 */
import i18next from "eslint-plugin-i18next";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser },
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          // JSX text, plus the props that people see or hear.
          mode: "jsx-only",
          "jsx-attributes": {
            include: ["title", "label", "placeholder", "hint", "message", "accessibilityLabel", "accessibilityHint"],
          },
          "should-validate-template": true,
        },
      ],
    },
  },
];
