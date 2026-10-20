import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      ".next-review/**",
      ".tmp/**",
      "test-results/**",
      ".agents/**",
      "node_modules/**",
      "coverage/**",
      "next-env.d.ts"
    ]
  }
];

export default eslintConfig;
