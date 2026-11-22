// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import pluginImport from 'eslint-plugin-import';
import pluginVue from 'eslint-plugin-vue';

import pluginVitest from '@vitest/eslint-plugin';
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';

import { designSystemPlugin, designSystemRuleLevels } from './eslint/design-system';

// ✅ Import ESLint Import Plugin

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

/*
 * Design system rules (docs/admin-ui-design-spec.md, section 3). They warn everywhere during the
 * migration. When a task moves a folder onto the design system, it adds the folder here and the
 * rules become errors for it, for example 'src/modules/devices' or 'src/plugins/devices-*'.
 */
const DESIGN_SYSTEM_MIGRATED_FOLDERS: string[] = [
	// AR-9 … AR-12: the devices list, detail, edit drawer, wizards and the device plugin forms
	'src/modules/devices',
	'src/plugins/devices-*',
];

/** Files that may keep a rule during the migration, with the task that removes the exception */
const DESIGN_SYSTEM_EXCEPTIONS: { files: string[]; rules: string[] }[] = [
	// AR-13 (#1670) moves the canvas colours to theme tokens
	{ files: ['src/modules/automations/components/canvas/**/*.vue'], rules: ['fb-design/no-hex-colors'] },
];

export default defineConfigWithVueTs(
	{
		name: 'app/files-to-lint',
		files: ['**/*.{ts,mts,tsx,vue}'],
	},

	{
		name: 'app/files-to-ignore',
		ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
	},

	pluginVue.configs['flat/essential'],
	pluginVue.configs['flat/strongly-recommended'],
	pluginVue.configs['flat/recommended'],
	vueTsConfigs.recommended,

	{
		...pluginVitest.configs.recommended,
		files: ['src/**/__tests__/*'],
	},

	{
		name: 'import-rules',
		plugins: { import: pluginImport },
		rules: {
			'import/extensions': [
				'error',
				'ignorePackages',
				{
					ts: 'never',
					tsx: 'never',
					vue: 'always',
				},
			],
		},
		settings: {
			'import/resolver': {
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
				},
			},
		},
	},

	{
		name: 'design-system',
		files: ['src/**/*.vue'],
		plugins: { 'fb-design': designSystemPlugin },
		rules: designSystemRuleLevels('warn'),
	},

	...(DESIGN_SYSTEM_MIGRATED_FOLDERS.length > 0
		? [
				{
					name: 'design-system/migrated',
					files: DESIGN_SYSTEM_MIGRATED_FOLDERS.map((folder) => `${folder}/**/*.vue`),
					rules: designSystemRuleLevels('error'),
				},
			]
		: []),

	...DESIGN_SYSTEM_EXCEPTIONS.map((exception, index) => ({
		name: `design-system/exception-${index}`,
		files: exception.files,
		rules: Object.fromEntries(exception.rules.map((rule) => [rule, 'off' as const])),
	})),

	skipFormatting
);
