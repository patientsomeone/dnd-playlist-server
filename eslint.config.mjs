import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import stylistic from "@stylistic/eslint-plugin";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import {fileURLToPath} from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
// Preserve the agreed legacy policy: intentional any at API boundaries is allowed.
// Formatting rules moved out of typescript-eslint; promise checks remain enabled.
const rules = {
    "@typescript-eslint/no-explicit-any": ["off"],
    "@typescript-eslint/no-unsafe-argument": ["off"],
    "@typescript-eslint/no-unsafe-assignment": ["off"],
    "@typescript-eslint/no-unsafe-return": ["off"],
    "@typescript-eslint/no-floating-promises": ["error",{"ignoreVoid":true,"ignoreIIFE":true}],
    "@typescript-eslint/array-type": ["error",{"default":"array"}],
    "@typescript-eslint/consistent-type-assertions": ["error"],
    "@typescript-eslint/explicit-module-boundary-types": ["off"],
    "@typescript-eslint/restrict-template-expressions": ["error",{"allowAny":true,"allowBoolean":true,"allowNumber":true}],
    "@typescript-eslint/no-empty-function": ["warn"],
    "no-empty-function": ["off"],
    "@typescript-eslint/no-misused-new": ["warn"],
    "@typescript-eslint/no-namespace": ["error"],
    "@typescript-eslint/no-shadow": ["off",{"hoist":"all"}],
    "@typescript-eslint/no-unsafe-member-access": ["off"],
    "@typescript-eslint/no-unsafe-call": ["off"],
    "@typescript-eslint/no-unused-expressions": ["error"],
    "@typescript-eslint/no-unused-vars": ["off"],
    "@typescript-eslint/no-use-before-define": ["error",{"functions":false}],
    "@typescript-eslint/prefer-function-type": ["warn"],
    "@typescript-eslint/prefer-namespace-keyword": ["error"],
    "@typescript-eslint/unified-signatures": ["error"],
    "@typescript-eslint/no-unnecessary-type-assertion": ["warn"],
    "@typescript-eslint/await-thenable": ["error"],
    "@typescript-eslint/no-for-in-array": ["error"],
    "no-implied-eval": ["off"],
    "@typescript-eslint/no-implied-eval": ["error"],
    "@typescript-eslint/no-misused-promises": ["error"],
    "require-await": ["off"],
    "@typescript-eslint/require-await": ["error"],
    "@typescript-eslint/restrict-plus-operands": ["error"],
    "@typescript-eslint/unbound-method": ["error"],
    "constructor-super": ["off"],
    "getter-return": ["off"],
    "no-const-assign": ["off"],
    "no-dupe-args": ["off"],
    "no-dupe-class-members": ["off"],
    "no-dupe-keys": ["off"],
    "no-func-assign": ["off"],
    "no-import-assign": ["off"],
    "no-new-symbol": ["off"],
    "no-obj-calls": ["off"],
    "no-redeclare": ["off"],
    "no-setter-return": ["off"],
    "no-this-before-super": ["off"],
    "no-undef": ["off"],
    "no-unreachable": ["off"],
    "no-unsafe-negation": ["off"],
    "no-var": ["error"],
    "prefer-const": ["error"],
    "prefer-rest-params": ["error"],
    "prefer-spread": ["error"],
    "valid-typeof": ["off"],
    "@typescript-eslint/adjacent-overload-signatures": ["error"],
    "@typescript-eslint/ban-ts-comment": ["error"],
    "no-array-constructor": ["off"],
    "@typescript-eslint/no-array-constructor": ["error"],
    "@typescript-eslint/no-empty-interface": ["error"],
    "@typescript-eslint/no-extra-non-null-assertion": ["error"],
    "no-extra-semi": ["off"],
    "@typescript-eslint/no-inferrable-types": ["error"],
    "no-loss-of-precision": "error",
    "@typescript-eslint/no-non-null-asserted-optional-chain": ["error"],
    "@typescript-eslint/no-non-null-assertion": ["warn"],
    "@typescript-eslint/no-this-alias": ["error"],
    "@typescript-eslint/no-unnecessary-type-constraint": ["error"],
    "no-unused-vars": ["off"],
    "@typescript-eslint/no-var-requires": ["error"],
    "@typescript-eslint/prefer-as-const": ["error"],
    "@typescript-eslint/triple-slash-reference": ["error"],
    "comma-dangle": ["error"],
    "complexity": ["off"],
    "dot-notation": ["error"],
    "eqeqeq": ["error","smart"],
    "guard-for-in": ["error"],
    "id-denylist": ["error","any","Number","number","String","string","Boolean","boolean","Undefined","undefined"],
    "id-match": ["error"],
    "max-classes-per-file": ["error",1],
    "max-len": ["warn",{"code":320}],
    "new-parens": ["error"],
    "no-bitwise": ["error"],
    "no-caller": ["error"],
    "no-cond-assign": ["error"],
    "no-console": ["off"],
    "no-debugger": ["error"],
    "no-empty": ["error"],
    "no-eval": ["error"],
    "no-fallthrough": ["off"],
    "no-invalid-this": ["off"],
    "no-multiple-empty-lines": ["off"],
    "no-new-wrappers": ["error"],
    "no-shadow": ["off"],
    "no-throw-literal": ["error"],
    "no-trailing-spaces": ["error",{"skipBlankLines":true,"ignoreComments":false}],
    "no-undef-init": ["error"],
    "no-underscore-dangle": ["off"],
    "no-unsafe-finally": ["error"],
    "no-unused-expressions": ["off"],
    "no-unused-labels": ["error"],
    "no-use-before-define": ["off"],
    "object-shorthand": ["error"],
    "one-var": ["error","never"],
    "quote-props": ["off"],
    "radix": ["error"],
    "semi": ["off"],
    "spaced-comment": ["error","always",{"markers":["/"]}],
    "use-isnan": ["error"],
    "camelcase": ["error",{"properties":"never","ignoreDestructuring":false,"ignoreImports":false,"ignoreGlobals":false}],
    "block-spacing": ["error","always"],
    "@stylistic/quotes": ["error","double"],
    "@stylistic/semi": ["error"],
    "@stylistic/member-delimiter-style": ["error",{"multiline":{"delimiter":"semi","requireLast":true},"singleline":{"delimiter":"semi","requireLast":true}}],
    "@stylistic/no-extra-semi": ["error"],
    "@typescript-eslint/no-wrapper-object-types": "error",
    "@typescript-eslint/no-unsafe-function-type": "error"
};

export default [
    {ignores: ["**/node_modules/**", "dist/**", "coverage/**", "playwright-report/**", "test-results/**", "**/.i.*/**", "public/**"]},
    {
        files: ["src/**/*.ts", "src/**/*.tsx", "client/src/**/*.ts", "client/src/**/*.tsx", "tests/**/*.ts", "browser-tests/**/*.ts", "playwright.config.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {project: "./tsconfig.json", tsconfigRootDir: root},
            globals: globals.node
        },
        plugins: {"@typescript-eslint": tsPlugin, "@stylistic": stylistic, "react-hooks": hooks},
        rules
    },
    {
        files: ["src/agents/createList.ts", "src/client/**/*.ts", "client/src/**/*.ts", "client/src/**/*.tsx"],
        languageOptions: {globals: {...Object.fromEntries(Object.keys(globals.node).map((key) => [key, "off"])), ...globals.browser}}
    },
    {
        files: ["client/src/**/*.ts", "client/src/**/*.tsx"],
        languageOptions: {parserOptions: {project: "./tsconfig.client.json"}}
    },
    {
        files: ["src/agents/createList.ts", "src/client/**/*.ts"],
        languageOptions: {parserOptions: {project: "./tsconfig.legacy.json"}}
    },
    {
        files: ["src/shared/**/*.ts"],
        languageOptions: {globals: Object.fromEntries(Object.keys(globals.node).map((key) => [key, "off"]))}
    },
    {
        files: ["client/src/**/*.ts", "client/src/**/*.tsx"],
        rules: {"react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error"}
    },
    {
        files: ["tests/**/*.ts"],
        languageOptions: {parserOptions: {project: "./tsconfig.test.json"}, globals: globals.jest},
        rules: {"@typescript-eslint/require-await": "off", "@typescript-eslint/unbound-method": "off"}
    },
    {
        files: ["browser-tests/**/*.ts", "playwright.config.ts"],
        languageOptions: {parserOptions: {project: "./tsconfig.browser-tests.json"}}
    }
];
