import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelSchema } from '../store/channels.store.schemas';

import { useChannelsPlugin } from './useChannelsPlugin';

const channelSchema = ChannelSchema;

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
					channelSchema,
				},
			},
		],
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
];

vi.mock('./useChannelsPlugins', () => ({
	useChannelsPlugins: () => ({
		getByType: (type: string) => mockPluginList.find((p) => p.elements.find((el) => el.type === type)),
	}),
}));

describe('useChannelsPlugin', () => {
	it('returns plugin by type', () => {
		const { plugin } = useChannelsPlugin({ type: 'test-type' });
		expect(plugin.value?.name).toBe('Test Plugin');
	});

	it('returns undefined for unknown type', () => {
		const { plugin } = useChannelsPlugin({ type: 'unknown-type' });
		expect(plugin.value).toBeUndefined();
	});

	it('returns element by type', () => {
		const { element } = useChannelsPlugin({ type: 'test-type' });
		expect(element.value?.type).toBe('test-type');
	});

	it('returns undefined element for unknown type', () => {
		const { element } = useChannelsPlugin({ type: 'unknown-type' });
		expect(element.value).toBeUndefined();
	});
});
