import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertySchema } from '../store/channels.properties.store.schemas';

import { useChannelsPropertiesPlugins } from './useChannelsPropertiesPlugins';

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
		elements: [
			{
				type: 'another-type',
			},
		],
		isCore: false,
		modules: ['other-module'],
	},
];

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		injectPluginsManager: () => ({
			getPlugins: () => mockPluginList,
		}),
	};
});

vi.mock('../../config', () => ({
	useConfigPlugins: () => ({
		enabled: () => true,
		loaded: ref(true),
	}),
}));

describe('useChannelsPropertiesPlugins', () => {
	it('returns only plugins related to channels module', () => {
		const { plugins } = useChannelsPropertiesPlugins();
		expect(plugins.value.length).toBe(1);
		expect(plugins.value[0].type).toBe('test-plugin');
	});

	it('returns correct options list', () => {
		const { options } = useChannelsPropertiesPlugins();
		expect(options.value).toEqual([
			{
				value: 'test-type',
				label: 'Test Plugin',
				disabled: false,
			},
		]);
	});

	it('getByName returns correct plugin', () => {
		const { getByName } = useChannelsPropertiesPlugins();
		const plugin = getByName('test-plugin');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByName returns undefined for unknown plugin', () => {
		const { getByName } = useChannelsPropertiesPlugins();
		const plugin = getByName('nonexistent');
		expect(plugin).toBeUndefined();
	});

	it('getByType returns correct plugin', () => {
		const { getByType } = useChannelsPropertiesPlugins();
		const plugin = getByType('test-type');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByType returns undefined for unknown plugin', () => {
		const { getByType } = useChannelsPropertiesPlugins();
		const plugin = getByType('nonexistent');
		expect(plugin).toBeUndefined();
	});
});
