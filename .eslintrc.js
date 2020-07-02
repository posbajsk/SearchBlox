module.exports = {
  env: {
    browser: true,
    es2020: true,
    webextensions: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    ecmaVersion: 11,
  },
  rules: {
    'max-len': ['error', { code: 180 }],
    'linebreak-style': 0,
    'no-restricted-syntax': 0,
    'arrow-parens': 0,
    'no-await-in-loop': 0,
    'no-return-assign': 0,
    'no-console': 0,
    radix: 0,
  },
};
