import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        AbortController: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        globalThis: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: 'error',
      curly: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  { ignores: ['node_modules/', 'coverage/', 'public/'] },
];
