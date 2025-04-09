import { describe, expect, it, vi } from 'vitest';

import { DASHBOARD_MODULE_NAME } from '../dashboard.constants';

import { useTilesPlugin } from './useTilesPlugin';

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
];

vi.mock('./useTilesPlugins', () => ({
	useTilesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useTilesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useTilesPlugin({ type: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = useTilesPlugin({ type: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
