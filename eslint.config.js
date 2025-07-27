import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import react from 'eslint-plugin-react'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  {
    ignores: [
      'dist/**', 
      'node_modules/**', 
      'coverage/**', 
      '*.config.js',
      // Type definition files with many unused exports (future cleanup)
      'src/types/core.ts',
      'src/types/websocket.ts',
      // Generated and mock files 
      'public/mockServiceWorker.js',
      'src/test/mocks/**',
      'src/vite-env.d.ts',
      // Files with extensive console logging (development files)
      
    ]
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        NodeJS: 'readonly'
      },
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'react': react,
      '@typescript-eslint': tseslint
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      
      // React specific rules
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true }
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      
      // TypeScript specific rules  
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],
      // Allow unused parameters in function signatures and type definitions
      'no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      
      // General code quality
      'no-console': 'warn',
      'no-debugger': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'no-duplicate-imports': 'error',
      'no-undef': 'off', // TypeScript handles this
      'no-case-declarations': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  // Relaxed rules for test files
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'react-refresh/only-export-components': 'off'
    }
  },
  // Relaxed rules for mock files
  {
    files: ['**/mocks/**/*.{ts,tsx}', '**/*.mock.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off'
    }
  }
] 