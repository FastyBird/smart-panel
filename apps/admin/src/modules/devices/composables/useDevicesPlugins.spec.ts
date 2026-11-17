/* eslint-disable vue/one-component-per-file -- Isolated component stubs for plugin integration tests. */
import { defineComponent, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { DEVICES_MODULE_NAME } from '../devices.constants';
import { DeviceCreateReqSchema, DeviceSchema } from '../store/devices.store.schemas';

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
		routes: {
			wizard: {
				label: 'testPlugin.wizard.title',
				icon: 'mdi:test-tube',
				to: { name: 'test-plugin-wizard' },
				testId: 'test-plugin-wizard',
			},
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
				type: 'foreign-wizard-type',
				modules: ['other-module'],
				components: { deviceWizard: { component: defineComponent({ template: '<div data-test-id="foreign-flow" />' }) } },
			},
			{
				type: 'wizard-type',
				name: 'Wizard Type',
				components: {
					deviceWizard: { component: defineComponent({ template: '<div />' }) },
				},
				schemas: {
					deviceSchema,
					deviceCreateReqSchema: DeviceCreateReqSchema,
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
		type: 'detail-only-plugin',
		source: 'detail',
		name: 'Detail Only Plugin',
		description: 'Detail extension',
		links: { documentation: '', devDocumentation: '', bugsTracking: '' },
		elements: [
			{
				type: 'detail-only-type',
				components: { deviceDetailTabs: [{ id: 'custom', label: 'Custom', icon: 'mdi:test', component: defineComponent({ template: '<div />' }) }] },
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
		expect(plugins.value.length).toBe(3);
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

	it('discovers detail-only elements without offering them as creatable device types', () => {
		const { getElement, options, wizardOptions } = useDevicesPlugins();

		expect(getElement('detail-only-type')?.components?.deviceDetailTabs).toBeDefined();
		expect(options.value.map((option) => option.value)).not.toContain('detail-only-type');
		expect(wizardOptions.value.map((option) => option.value)).not.toContain('detail-only-plugin');
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

	it('resolves a wizard only from an element eligible for the devices module', () => {
		const { getWizard, getElement } = useDevicesPlugins();
		expect(getWizard('wizard-plugin')).toBe(getElement('wizard-type')?.components?.deviceWizard);
		expect(getWizard('test-plugin')).toBeUndefined();
		expect(getWizard('unrelated-plugin')).toBeUndefined();
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

	it('does not expose standalone route launchers as a second wizard registry', () => {
		const { wizardOptions } = useDevicesPlugins();
		expect(wizardOptions.value.map((item) => item.value)).not.toContain('test-plugin');
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
