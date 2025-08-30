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
		elements: [
			{
				type: 'test-type',
				schemas: {
					deviceSchema,
				},
			},
		],
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useDevicesPlugins', () => ({
	useDevicesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('useDevicesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useDevicesPlugin({ type: 'test-type' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined plugin for unknown type', () => {
		const { plugin } = useDevicesPlugin({ type: 'unknown-type' });
		expect(plugin.value).toBeUndefined();
	});

	it('returns element by type', () => {
		const { element } = useDevicesPlugin({ type: 'test-type' });
		expect(element.value?.type).toBe('test-type');
	});

	it('returns undefined element for unknown type', () => {
		const { element } = useDevicesPlugin({ type: 'unknown-type' });
		expect(element.value).toBeUndefined();
	});
});
