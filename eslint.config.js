// ESLint: poucas regras, só o que pega erro de verdade (recomendadas + variável sem uso + ===).
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', '.painel-build/', 'node_modules/', '.npm-cache/', 'test-results/', 'playwright-report/', 'src/painel/modelo.gerado.html'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: {
      'no-unused-vars': ['error', { args: 'after-used', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Node: testes, scripts, configs e o leitor (que também roda no Node).
    files: ['tests/**', 'scripts/**', 'e2e/**', '*.config.js', 'src/leitor/**', 'src/**/*.worker.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
