import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { SPACES_MODULE_NAME } from '../spaces.constants';

import { useSpacesPlugins } from './useSpacesPlugins';

vi.mock('../spaces.constants', () => ({
	SPACES_MODULE_NAME: 'spaces-module',
}));

const mockPluginList = [
	{
		type: 'route-only-plugin',
		source: 'source',
		name: 'Route Only Plugin',
		description: 'Description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'route-only-type',
			},
		],
		routes: {
			configure: '/space/plugin/configure',
		},
		isCore: false,
		modules: [SPACES_MODULE_NAME],
	},
	{
		type: 'wizard-plugin',
		source: 'source3',
		name: 'Wizard Plugin',
		description: 'Wizard plugin description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'wizard-type',
				name: 'Wizard Type',
				components: {
					spaceWizard: {},
				},
			},
			{
				type: 'non-wizard-type',
				name: 'Non Wizard Type',
				components: {},
			},
		],
		isCore: false,
		modules: [SPACES_MODULE_NAME],
	},
	{
		type: 'space-type-plugin',
		source: 'source4',
		name: 'Space Type Plugin',
		description: 'Space type plugin description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'space-type',
				name: 'Space Type',
				components: {
					spaceAddForm: {},
				},
			},
		],
		isCore: false,
		modules: [SPACES_MODULE_NAME],
	},
	{
		type: 'unrelated-plugin',
		source: 'source2',
		name: 'Unrelated Plugin',
		description: 'Desc2',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'another-type',
			},
		],
		routes: {
			configure: '/other-module/plugin/configure',
		},
		isCore: false,
		modules: ['other-module'],
	},
];

vi.mock('../../../common', () => ({
	injectPluginsManager: () => ({
		getPlugins: () => mockPluginList,
	}),
}));

vi.mock('../../config', () => ({
	useConfigPlugins: () => ({
		enabled: () => true,
		loaded: ref(true),
	}),
}));

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
		te: () => false,
	}),
}));

describe('useSpacesPlugins', () => {
	it('returns spaces plugins that only contribute a configure route', () => {
		const { plugins } = useSpacesPlugins();

		expect(plugins.value.some((plugin) => plugin.type === 'route-only-plugin')).toBe(true);
	});

	it('exposes configure routes on discovered spaces plugins', () => {
		const { getByType } = useSpacesPlugins();

		expect(getByType('route-only-type')?.routes?.configure).toBe('/space/plugin/configure');
	});

	it('exposes only wizard-capable spaces plugin elements as wizard options', () => {
		const { wizardOptions } = useSpacesPlugins();

		expect(wizardOptions.value).toEqual([
			{
				value: 'wizard-plugin',
				label: 'Wizard Plugin',
				description: 'Wizard plugin description',
				disabled: false,
			},
		]);
	});

	it('excludes wizard-only elements from regular space type options', () => {
		const { options } = useSpacesPlugins();

		expect(options.value).toEqual([
			{
				value: 'space-type',
				label: 'Space Type',
				disabled: false,
			},
		]);
	});
});
