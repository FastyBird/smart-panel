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
];

vi.mock('./useDataSourcesPlugins', () => ({
	useDataSourcesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('useDataSourcesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useDataSourcesPlugin({ type: 'test-type' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined plugin for unknown type', () => {
		const { plugin } = useDataSourcesPlugin({ type: 'unknown-type' });
		expect(plugin.value).toBeUndefined();
	});

	it('returns element by type', () => {
		const { element } = useDataSourcesPlugin({ type: 'test-type' });
		expect(element.value?.type).toBe('test-type');
	});

	it('returns undefined element for unknown type', () => {
		const { element } = useDataSourcesPlugin({ type: 'unknown-type' });
		expect(element.value).toBeUndefined();
	});
});
