import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';
import { PageSchema } from '../store/pages.store.schemas';

import { usePagesPlugin } from './usePagesPlugin';

const pageSchema = PageSchema;

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
			pageSchema,
		},
		isCore: false,
		modules: [DASHBOARD_MODULE_NAME],
	},
];

vi.mock('./usePagesPlugins', () => ({
	usePagesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('usePagesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = usePagesPlugin({ type: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = usePagesPlugin({ type: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
