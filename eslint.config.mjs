import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
  // Custom rule overrides
  {
    rules: {
      // Allow apostrophes in JSX text (common in natural language content)
      'react/no-unescaped-entities': ['error', { forbid: ['>', '}'] }],
    },
  },
]);

export default eslintConfig;
