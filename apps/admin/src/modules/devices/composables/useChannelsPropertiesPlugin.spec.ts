import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertySchema } from '../store/channels.properties.store.schemas';

import { useChannelsPropertiesPlugin } from './useChannelsPropertiesPlugin';

const channelPropertySchema = ChannelPropertySchema;

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
					channelPropertySchema,
				},
			},
		],
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useChannelsPropertiesPlugins', () => ({
	useChannelsPropertiesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('useChannelsPropertiesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useChannelsPropertiesPlugin({ type: 'test-type' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined plugin for unknown type', () => {
		const { plugin } = useChannelsPropertiesPlugin({ type: 'unknown-type' });
		expect(plugin.value).toBeUndefined();
	});

	it('returns element by type', () => {
		const { element } = useChannelsPropertiesPlugin({ type: 'test-type' });
		expect(element.value?.type).toBe('test-type');
	});

	it('returns undefined element for unknown type', () => {
		const { element } = useChannelsPropertiesPlugin({ type: 'unknown-type' });
		expect(element.value).toBeUndefined();
	});
});
