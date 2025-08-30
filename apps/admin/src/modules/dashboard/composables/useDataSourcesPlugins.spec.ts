import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DataSourceSchema } from '../store/data-sources.store.schemas';

import { useDataSourcesPlugins } from './useDataSourcesPlugins';

const dataSourceSchema = DataSourceSchema;

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
				type: 'test-type',
				schemas: {
					dataSourceSchema,
				},
			},
		],
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
		elements: [
			{
				type: 'another-type',
			},
		],
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
		const { plugins } = useDataSourcesPlugins();
		expect(plugins.value.length).toBe(1);
		expect(plugins.value[0].type).toBe('test-plugin');
	});

	it('returns correct options list', () => {
		const { options } = useDataSourcesPlugins();
		expect(options.value).toEqual([
			{
				value: 'test-type',
				label: 'Test Plugin',
			},
		]);
	});

	it('getByName returns correct plugin', () => {
		const { getByName } = useDataSourcesPlugins();
		const plugin = getByName('test-plugin');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByName returns undefined for unknown plugin', () => {
		const { getByName } = useDataSourcesPlugins();
		const plugin = getByName('nonexistent');
		expect(plugin).toBeUndefined();
	});

	it('getByType returns correct plugin', () => {
		const { getByType } = useDataSourcesPlugins();
		const plugin = getByType('test-type');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByType returns undefined for unknown plugin', () => {
		const { getByType } = useDataSourcesPlugins();
		const plugin = getByType('nonexistent');
		expect(plugin).toBeUndefined();
	});
});
