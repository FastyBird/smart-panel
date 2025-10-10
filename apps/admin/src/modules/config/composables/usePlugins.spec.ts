import { describe, expect, it, vi } from 'vitest';

import { CONFIG_MODULE_NAME } from '../config.constants';

import { usePlugins } from './usePlugins';

const mockPluginList = [
	{
		type: 'test-plugin',
		source: 'source',
		name: 'Test Plugin',
		description: 'Description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'test-plugin',
			},
		],
		isCore: false,
		modules: [CONFIG_MODULE_NAME],
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
		isCore: false,
		modules: ['other-module'],
	},
];

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectPluginsManager: () => ({
			getPlugins: () => mockPluginList,
		}),
	};
});

describe('usePlugins', () => {
	it('returns only plugins related to devices module', () => {
		const { plugins } = usePlugins();
		expect(plugins.value.length).toBe(1);
		expect(plugins.value[0].type).toBe('test-plugin');
	});

	it('returns correct options list', () => {
		const { options } = usePlugins();
		expect(options.value).toEqual([
			{
				value: 'test-plugin',
				label: 'Test Plugin',
			},
		]);
	});

	it('getByType returns correct plugin', () => {
		const { getByName } = usePlugins();
		const plugin = getByName('test-plugin');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByType returns undefined for unknown plugin', () => {
		const { getByName } = usePlugins();
		const plugin = getByName('nonexistent');
		expect(plugin).toBeUndefined();
	});
});
