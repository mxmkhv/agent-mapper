import { defineConfig } from "oxlint";

export default defineConfig({
  categories: { correctness: "error" },
  plugins: ["typescript", "oxc", "unicorn", "import"],
  ignorePatterns: [
    "**/dist/**",
    "**/node_modules/**",
    ".worktrees/**",
    ".artifacts/**",
    "coverage/**",
    "prototypes/**",
    "tools/oxlint/anti-slop/**"
  ],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }
  ],
  rules: {
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
    "no-nested-ternary": "error",
    complexity: ["error", { max: 15 }],
    "max-lines": ["error", { max: 250, skipBlankLines: true }],
    "max-params": ["error", { max: 2 }],
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }
    ],
    "no-magic-numbers": [
      "error",
      {
        ignore: [-1, 0, 1, 2],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreNumericLiteralTypes: true,
        ignoreTypeIndexes: true
      }
    ],
    "import/no-default-export": "error",
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-widen-then-assert": "error"
  },
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        "max-lines-per-function": ["error", { max: 50, skipBlankLines: true }]
      }
    },
    {
      files: ["**/*.test.ts", "**/*.spec.ts", "**/constants.ts"],
      rules: { "no-magic-numbers": "off" }
    },
    {
      files: ["**/*config.ts"],
      rules: { "import/no-default-export": "off", "no-magic-numbers": "off" }
    },
    {
      files: ["packages/web/src/**/*.{ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      env: { browser: true },
      rules: {
        "react/rules-of-hooks": "error",
        "react/exhaustive-deps": "error",
        "no-restricted-imports": [
          "error",
          { patterns: ["@agent-mapper/cli", "node:*", "**/cli/src/**"] }
        ]
      }
    },
    {
      files: ["packages/core/src/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              "node:*",
              "bun",
              "bun:*",
              "react",
              "react-dom",
              "@agent-mapper/web",
              "agent-mapper",
              "**/cli/**",
              "**/web/**"
            ]
          }
        ]
      }
    },
    {
      files: ["packages/cli/src/**/*.ts"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              "react",
              "react-dom",
              "@agent-mapper/web",
              "**/web/src/**"
            ]
          }
        ]
      }
    }
  ]
});
