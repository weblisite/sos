module.exports = {
  root: false, // Extends from root .eslintrc.json
  extends: ['../../.eslintrc.json'],
  env: { browser: true, es2020: true },
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
};

