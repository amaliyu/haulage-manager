import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@supabase/supabase-js',
              message: 'Supabase is only used from src/lib/supabase.ts and src/services/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/supabase.ts', 'src/services/**/*.ts', 'src/hooks/useAuth.tsx'],
    rules: { 'no-restricted-imports': 'off' },
  },
)
