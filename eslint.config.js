const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        process:    'readonly',
        require:    'readonly',
        module:     'readonly',
        console:    'readonly',
        __dirname:  'readonly',
        Buffer:     'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-implicit-globals': 'error',
    },
  },
];