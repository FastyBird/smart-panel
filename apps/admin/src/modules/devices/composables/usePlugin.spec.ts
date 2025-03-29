import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../index';

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
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./usePlugins', () => ({
	usePlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('usePlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = usePlugin('test-plugin');
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = usePlugin('unknown-plugin');
		expect(plugin.value).toBeUndefined();
	});
});
