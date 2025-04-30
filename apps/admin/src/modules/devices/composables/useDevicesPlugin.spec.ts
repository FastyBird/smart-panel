import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DeviceSchema } from '../store/devices.store.schemas';

import { useDevicesPlugin } from './useDevicesPlugin';

const deviceSchema = DeviceSchema;

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
			deviceSchema,
		},
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useDevicesPlugins', () => ({
	useDevicesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useDevicesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useDevicesPlugin({ type: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = useDevicesPlugin({ type: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
