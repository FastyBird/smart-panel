// @ts-check
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import eslint from '@eslint/js';

export default tseslint.config(
	{
		ignores: ['eslint.config.mjs', 'dist/*', 'postcss.config.js'],
	},
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	eslintPluginPrettierRecommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			ecmaVersion: 2020,
			sourceType: 'module',
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
	},
	{
		plugins: {
			'react-hooks': reactHooksPlugin,
		},
		rules: {
			...reactHooksPlugin.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-floating-promises': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'comma-dangle': ['error', 'always-multiline'],
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
);
