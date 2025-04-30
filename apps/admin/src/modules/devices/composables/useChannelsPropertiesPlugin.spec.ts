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
		schemas: {
			channelPropertySchema,
		},
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useChannelsPropertiesPlugins', () => ({
	useChannelsPropertiesPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.type === type),
	}),
}));

describe('useChannelsPropertiesPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useChannelsPropertiesPlugin({ type: 'test-plugin' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = useChannelsPropertiesPlugin({ type: 'unknown-plugin' });
		expect(plugin.value).toBeUndefined();
	});
});
