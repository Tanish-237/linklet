import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'dist-ssr'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // `argsIgnorePattern` (separate from `varsIgnorePattern`) is needed too:
      // destructured function PARAMETERS — e.g. `({ game: GameComponent }) =>`
      // — are checked under the rule's "args" handling, not "vars", so a
      // PascalCase component pulled out of props and used only in JSX was
      // being flagged as unused even though it's rendered.
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }],
      // This codebase deliberately swallows errors in a lot of best-effort
      // fallback paths (`try { localStorage.setItem(...) } catch {}`,
      // Redis-optional cache writes, etc.) — that's an intentional, established
      // pattern here, not a mistake to flag on every occurrence.
      'no-empty': ['error', { allowEmptyCatch: true }],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
]
