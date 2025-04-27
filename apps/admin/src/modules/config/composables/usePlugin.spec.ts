import { describe, expect, it, vi } from 'vitest';

import { CONFIG_MODULE_NAME } from '../config.constants';

import { usePlugin } from './usePlugin';

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
		modules: [CONFIG_MODULE_NAME],
	},
];

vi.mock('./usePlugins', () => ({
	usePlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('usePlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = usePlugin({ type: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = usePlugin({ type: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
