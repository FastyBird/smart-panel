import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { DataSourceSchema } from '../store/data-sources.store.schemas';

import { useDataSourcesPlugin } from './useDataSourcesPlugin';

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
		schemas: {
			dataSourceSchema,
		},
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./useDataSourcesPlugins', () => ({
	useDataSourcesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useDataSourcesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useDataSourcesPlugin({ type: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = useDataSourcesPlugin({ type: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
