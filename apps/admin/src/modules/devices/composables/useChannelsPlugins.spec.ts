import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelSchema } from '../store/channels.store.schemas';

import { useChannelsPlugins } from './useChannelsPlugins';

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
		schemas: {
			channelSchema,
		},
		isCore: false,
		modules: [DEVICES_MODULE_NAME],
	},
	{
		type: 'unrelated-plugin',
		source: 'source2',
		name: 'Unrelated Plugin',
		description: 'Desc2',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		isCore: false,
		modules: ['other-module'],
	},
];

vi.mock('../../../common', () => ({
	injectPluginsManager: () => ({
		getPlugins: () => mockPluginList,
	}),
}));

describe('useChannelsPlugins', () => {
	it('returns only plugins related to channels module', () => {
		const { plugins } = useChannelsPlugins();
		expect(plugins.value.length).toBe(1);
		expect(plugins.value[0].type).toBe('test-plugin');
	});

	it('returns correct options list', () => {
		const { options } = useChannelsPlugins();
		expect(options.value).toEqual([
			{
				value: 'test-plugin',
				label: 'Test Plugin',
			},
		]);
	});

	it('getByType returns correct plugin', () => {
		const { getByType } = useChannelsPlugins();
		const plugin = getByType('test-plugin');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByType returns undefined for unknown plugin', () => {
		const { getByType } = useChannelsPlugins();
		const plugin = getByType('nonexistent');
		expect(plugin).toBeUndefined();
	});
});
