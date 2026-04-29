import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        global: 'readonly',
        log: 'readonly',
        Uint8Array: 'readonly',
        ARGV: 'readonly',
        Debugger: 'readonly',
        GIRepositoryLib: 'readonly',
        imports: 'readonly',
        Intl: 'readonly',
        print: 'readonly',
        printerr: 'readonly',
        window: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-array-constructor': 'off',
      'no-undef': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      'no-empty': 'off',
      'no-case-declarations': 'off',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/ban-ts-comment': 'off'
    }
  }
);
