import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';

import { usePagesPlugins } from './usePagesPlugins';

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
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
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
		isCore: false,
		modules: ['other-module'],
	},
];

vi.mock('../../../common', () => ({
	injectPluginsManager: () => ({
		getPlugins: () => mockPluginList,
	}),
}));

describe('usePlugins', () => {
	it('returns only plugins related to devices module', () => {
		const { plugins } = usePagesPlugins();
		expect(plugins.value.length).toBe(1);
		expect(plugins.value[0].type).toBe('test-plugin');
	});

	it('returns correct options list', () => {
		const { options } = usePagesPlugins();
		expect(options.value).toEqual([
			{
				value: 'test-plugin',
				label: 'Test Plugin',
			},
		]);
	});

	it('getByType returns correct plugin', () => {
		const { getByType } = usePagesPlugins();
		const plugin = getByType('test-plugin');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByType returns undefined for unknown plugin', () => {
		const { getByType } = usePagesPlugins();
		const plugin = getByType('nonexistent');
		expect(plugin).toBeUndefined();
	});
});
