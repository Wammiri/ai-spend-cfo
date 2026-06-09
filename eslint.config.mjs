// Next.js 16 ships eslint-config-next as native ESLint flat config, so the
// shared configs are spread directly. (The older FlatCompat bridge through
// @eslint/eslintrc breaks on this version with a circular-structure error.)
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "out/**",
      "coverage/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
