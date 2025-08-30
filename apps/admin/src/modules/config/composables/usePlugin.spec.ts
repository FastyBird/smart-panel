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
		elements: [
			{
				type: 'test-plugin',
			},
		],
		isCore: false,
		modules: [CONFIG_MODULE_NAME],
	},
];

vi.mock('./usePlugins', () => ({
	usePlugins: () => ({
		getByName: (name: string) => mockPluginList.find((p) => p.type === name),
	}),
}));

describe('usePlugin', () => {
	it('returns plugin by name', () => {
		const { plugin } = usePlugin({ name: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown name', () => {
		const { plugin } = usePlugin({ name: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
