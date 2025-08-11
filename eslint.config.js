import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig(
	[
		{
			files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
			plugins: { js },
			extends: ['js/recommended'],
			languageOptions: { globals: globals.browser }
		},
		{ files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
		tseslint.configs.recommended
	],
	globalIgnores([
		'.DS_Store',
		'node_modules',
		'build',
		'runner',
		'.svelte-kit',
		'.env',
		'.env.*',
		'!.env.example',
		'pnpm-lock.yaml'
	])
);
