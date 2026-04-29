import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DeviceSchema } from '../store/devices.store.schemas';

import { useDevicesPlugins } from './useDevicesPlugins';

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
	{
		type: 'wizard-plugin',
		source: 'source3',
		name: 'Wizard Plugin',
		description: 'Wizard plugin description',
		links: {
			documentation: '',
			devDocumentation: '',
			bugsTracking: '',
		},
		elements: [
			{
				type: 'wizard-type',
				name: 'Wizard Type',
				components: {
					deviceWizard: {},
				},
			},
			{
				type: 'non-wizard-type',
				name: 'Non Wizard Type',
				components: {},
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

vi.mock('../../../common', () => ({
	injectPluginsManager: () => ({
		getPlugins: () => mockPluginList,
	}),
}));

vi.mock('../../config', async (importOriginal) => ({
	...(await importOriginal<typeof import('../../config')>()),
	useConfigPlugins: () => ({
		enabled: () => true,
		loaded: ref(true),
	}),
}));

describe('useDevicesPlugins', () => {
	it('returns only plugins related to devices module', () => {
		const { plugins } = useDevicesPlugins();
		expect(plugins.value.length).toBe(2);
		expect(plugins.value[0]?.type).toBe('test-plugin');
	});

	it('returns correct options list', () => {
		const { options } = useDevicesPlugins();
		expect(options.value).toEqual([
			{
				value: 'test-type',
				label: 'Test Plugin',
				disabled: false,
			},
		]);
	});

	it('getByName returns correct plugin', () => {
		const { getByName } = useDevicesPlugins();
		const plugin = getByName('test-plugin');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByName returns undefined for unknown plugin', () => {
		const { getByName } = useDevicesPlugins();
		const plugin = getByName('nonexistent');
		expect(plugin).toBeUndefined();
	});

	it('getByType returns correct plugin', () => {
		const { getByType } = useDevicesPlugins();
		const plugin = getByType('test-type');
		expect(plugin?.name).toBe('Test Plugin');
	});

	it('getByType returns undefined for unknown plugin', () => {
		const { getByType } = useDevicesPlugins();
		const plugin = getByType('nonexistent');
		expect(plugin).toBeUndefined();
	});

	it('getByPluginType returns correct plugin', () => {
		const { getByPluginType } = useDevicesPlugins();
		const plugin = getByPluginType('wizard-plugin');

		expect(plugin?.name).toBe('Wizard Plugin');
	});

	it('exposes only wizard-capable devices plugins as wizard options', () => {
		const { wizardOptions } = useDevicesPlugins();

		expect(wizardOptions.value).toEqual([
			{
				value: 'wizard-plugin',
				label: 'Wizard Plugin',
				description: 'Wizard plugin description',
				disabled: false,
			},
		]);
	});

	it('excludes wizard-only elements from regular device type options', () => {
		const { options } = useDevicesPlugins();

		expect(options.value).toEqual([
			{
				value: 'test-type',
				label: 'Test Plugin',
				disabled: false,
			},
		]);
	});
});
