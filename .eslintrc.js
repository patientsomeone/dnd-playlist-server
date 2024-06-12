module.exports = {
    env: {
        browser: true,
        node: true,
        es6: true
    },
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    overrides: [{
        files: ["**/*.ts", "**/*.tsx"],
        extends: [
            "plugin:@typescript-eslint/recommended",
            "plugin:@typescript-eslint/recommended-requiring-type-checking"
        ],
        parserOptions: {
            project: "./tsconfig.json",
            tsconfigRootDir: __dirname
        },
        rules: {
            "@typescript-eslint/no-unsafe-argument": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-return": "off",
            "@typescript-eslint/no-floating-promises": [
                "error", {
                    "ignoreVoid": true,
                    "ignoreIIFE": true
                }
            ],
            "@typescript-eslint/array-type": [
                "error",
                {
                    default: "array"
                }
            ],
            "@typescript-eslint/consistent-type-assertions": "error",
            "@typescript-eslint/explicit-module-boundary-types": "warn",
            "@typescript-eslint/member-delimiter-style": [
                "error",
                {
                    multiline: {
                        delimiter: "semi",
                        requireLast: true
                    },
                    singleline: {
                        delimiter: "semi",
                        requireLast: true
                    }
                }
            ],
            "@typescript-eslint/no-empty-function": "warn",
            "@typescript-eslint/no-misused-new": "warn",
            "@typescript-eslint/no-namespace": "error",
            "@typescript-eslint/no-shadow": [
                "off",
                {
                    hoist: "all"
                }
            ],
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unused-expressions": "error",
            "@typescript-eslint/no-unused-vars": "off" /* ["warn", { vars: "local" }] */ ,
            "@typescript-eslint/no-use-before-define": "error",
            "@typescript-eslint/prefer-function-type": "warn",
            "@typescript-eslint/prefer-namespace-keyword": "error",
            "@typescript-eslint/semi": "error",
            "@typescript-eslint/unified-signatures": "error",
            "@typescript-eslint/quotes": ["error", "double"]
        }
    }],
    rules: {
        "comma-dangle": "error",
        complexity: "off",
        "constructor-super": "error",
        "dot-notation": "error",
        eqeqeq: ["error", "smart"],
        "guard-for-in": "error",
        "id-denylist": [
            "error",
            "any",
            "Number",
            "number",
            "String",
            "string",
            "Boolean",
            "boolean",
            "Undefined",
            "undefined"
        ],
        "id-match": "error",
        "max-classes-per-file": ["error", 1],
        "max-len": ["warn", { code: 320 }],
        "new-parens": "error",
        "no-bitwise": "error",
        "no-caller": "error",
        "no-cond-assign": "error",
        "no-console": [
            "warn",
            {
                allow: [
                    "info",
                    "warn",
                    "dir",
                    "timeLog",
                    "assert",
                    "clear",
                    "count",
                    "countReset",
                    "group",
                    "groupEnd",
                    "table",
                    "dirxml",
                    "error",
                    "groupCollapsed",
                    "Console",
                    "profile",
                    "profileEnd",
                    "timeStamp",
                    "context"
                ]
            }
        ],
        "no-debugger": "error",
        "no-empty": "error",
        "no-empty-function": "error",
        "no-eval": "error",
        "no-fallthrough": "off",
        "no-invalid-this": "off",
        "no-multiple-empty-lines": "off",
        "no-new-wrappers": "error",
        "no-shadow": "off",
        "no-throw-literal": "error",
        "no-trailing-spaces": [
            "error",
            {
                skipBlankLines: true
            }
        ],
        "no-undef-init": "error",
        "no-underscore-dangle": "off",
        "no-unsafe-finally": "error",
        "no-unused-expressions": "off",
        "no-unused-labels": "error",
        "no-use-before-define": "off",
        "no-var": "error",
        "object-shorthand": "error",
        "one-var": ["error", "never"],
        "prefer-const": "error",
        "quote-props": "off",
        radix: "error",
        semi: "off",
        "spaced-comment": [
            "error",
            "always",
            {
                markers: ["/"]
            }
        ],
        "use-isnan": "error",
        "valid-typeof": "off",
        camelcase: "error",
        "block-spacing": ["error", "always"]
    }
};