module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    parser: "@typescript-eslint/parser",
    parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
            jsx: true,
        },
    },
    plugins: ["@typescript-eslint"],
    extends: ["eslint:recommended"],
    ignorePatterns: [
        "coverage/",
        "playwright-report/",
        "test-results/",
        "dist/",
        "node_modules/",
    ],
    overrides: [
        {
            files: ["*.ts", "*.tsx", "*.mts"],
            rules: {
                "no-undef": "off",
                "no-unused-vars": "off",
            },
        },
    ],
};
