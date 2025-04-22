module.exports = {
  extends: [
    "next/core-web-vitals",
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
  ],
  plugins: ["@typescript-eslint", "react", "@million/lint"],
  parser: "@typescript-eslint/parser",
  rules: {
    // Error prevention
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",

    // Code style
    quotes: ["error", "single"],
    semi: ["error", "always"],
    indent: ["error", 2],
    "comma-dangle": ["error", "always-multiline"],
    "arrow-parens": ["error", "always"],

    // React rules
    "react/react-in-jsx-scope": "off", // Not needed in Next.js
    "react/prop-types": "off", // We use TypeScript instead
    "react/jsx-filename-extension": [1, { extensions: [".tsx"] }],

    // Million.js optimization
    "@million/react-missing-key": "warn",
  },
  settings: {
    react: {
      version: "detect",
    },
  },
  ignorePatterns: [
    "node_modules/",
    ".next/",
    "*.config.js",
    ".github/",
    "public/",
  ],
  globals: {
    React: "writable",
  },
};
