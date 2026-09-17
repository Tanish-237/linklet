import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['node_modules', 'coverage'] },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Destructured/positional params that exist to document a callback's
      // shape (e.g. Express's `(err, req, res, next)`) but aren't all used.
      // Best-effort fallback paths (Redis-optional cache writes, etc.) deliberately
      // ignore the caught error in a lot of places — an established pattern here,
      // not a mistake to flag, matching `no-empty`'s allowEmptyCatch below.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
]
