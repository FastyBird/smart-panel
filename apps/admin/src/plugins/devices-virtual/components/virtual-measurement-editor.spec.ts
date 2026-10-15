import { ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';

import VirtualMeasurementEditor from './virtual-measurement-editor.vue';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), properties: [] as unknown[] }));
vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: unknown) => `${key}${params ? JSON.stringify(params) : ''}`, te: () => true }),
}));
vi.mock('../../../modules/devices/store/keys', () => ({
	devicesStoreKey: 'devices',
	channelsStoreKey: 'channels',
	channelsPropertiesStoreKey: 'properties',
}));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: mocks }),
	injectStoresManager: () => ({
		getStore: (key: string) => ({ fetch: async () => {}, findAll: () => (key === 'properties' ? mocks.properties : []) }),
	}),
}));
const profiles = [
	{
		profile: 'temperature',
		channel: 'temperature',
		quantity: 'temperature',
		unit: '°C',
		data_types: ['float'],
		operators: ['mean', 'weighted_mean'],
		numeric_policy: true,
		output_step: null,
	},
	{
		profile: 'humidity',
		channel: 'humidity',
		quantity: 'humidity',
		unit: '%',
		data_types: ['uchar'],
		operators: ['mean', 'weighted_mean'],
		numeric_policy: true,
		output_step: 1,
	},
	{
		profile: 'contact',
		channel: 'contact',
		quantity: 'detected',
		unit: null,
		data_types: ['bool'],
		operators: ['any', 'all'],
		numeric_policy: false,
		output_step: null,
	},
];
const state = {
	profile: 'humidity',
	output_property: 'output',
	output_step: 1,
	rounding: 'nearest_ties_positive',
	outlier_filter: { kind: 'absolute_deviation_from_median', threshold: 5 },
	operator: 'weighted_mean',
	minimum_valid_inputs: 1,
	maximum_age_seconds: 60,
	revision: 7,
	graph_revision: 10,
	runtime_readiness: 'ready',
	inputs: [
		{ id: 'binding', source_property: null, source_identity: 'deleted-id', weight: 2, exclusion: 'missing' },
		{ id: 'binding2', source_property: 'outlier-id', source_identity: 'outlier-id', weight: 1, exclusion: 'outlier', age_seconds: 9 },
	],
};
const mountEditor = async (outputId?: string) => {
	const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_aggregate, outputId } });
	await flushPromises();
	return wrapper;
};
beforeEach(() => {
	vi.resetAllMocks();
	mocks.properties = [];
	mocks.GET.mockImplementation(async (path: string) => ({
		data: {
			data: path.endsWith('aggregate-profiles') ? profiles : path.endsWith('/sources') ? [{ property: 'allowed', channel: 'c', device: 'd' }] : state,
		},
	}));
});
afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('aggregate editor', () => {
	it('uses profile capabilities to switch numeric controls and canonical sources to binary controls', async () => {
		const wrapper = await mountEditor();
		const profile = wrapper.findAllComponents(ElSelect).find((select) => select.attributes('data-test-id') === 'aggregate-profile')!;
		profile.vm.$emit('update:modelValue', 'humidity');
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-grid"]').text()).toContain('%');
		const operator = wrapper.findAllComponents(ElSelect).find((select) => select.props('modelValue') === 'mean')!;
		operator.vm.$emit('update:modelValue', 'weighted_mean');
		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('.addInput'))!
			.trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-test-id="aggregate-weight"]').exists()).toBe(true);
		wrapper.findComponent(ElSwitch).vm.$emit('update:modelValue', true);
		await flushPromises();
		expect(wrapper.text()).toContain('filterThreshold{"unit":"%"}');
		profile.vm.$emit('update:modelValue', 'contact');
		await flushPromises();
		expect(wrapper.find('[data-test-id="aggregate-weight"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="aggregate-filter"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="aggregate-grid"]').exists()).toBe(false);
		expect(wrapper.findAllComponents(ElSelect).some((select) => select.props('modelValue') === 'any')).toBe(true);
		wrapper.unmount();
	});
	it('repairs a missing member using only admitted source IDs and retains binding and graph fences', async () => {
		const wrapper = await mountEditor('output');
		expect(wrapper.text()).toContain('deleted-id');
		expect(wrapper.text()).toContain('.states.outlier');
		expect(wrapper.text()).toContain('sampleAge{"age":9}');
		expect(
			wrapper
				.findAllComponents(ElSelect)
				.find((select) => select.attributes('data-test-id') === 'aggregate-profile')!
				.props('disabled')
		).toBe(true);
		const source = wrapper.findAllComponents(ElSelect).find((select) => select.props('modelValue') === null)!;
		expect(wrapper.findAllComponents(ElOption).some((option) => option.props('value') === 'allowed')).toBe(true);
		source.vm.$emit('update:modelValue', 'allowed');
		await flushPromises();
		mocks.POST.mockResolvedValueOnce({ data: { data: state } });
		await wrapper
			.findAll('button')
			.find((button) => button.text() === 'devicesVirtualPlugin.measurement.preview')!
			.trigger('click');
		await flushPromises();
		expect(mocks.POST.mock.calls[0][1].body).toMatchObject({
			expected_revision: 7,
			expected_graph_revision: 10,
			inputs: [{ id: 'binding', source_property: 'allowed', weight: 2 }, {}],
		});
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain('.aggregatePreviewOnly');
		// Any subsequent policy edit invalidates the reviewed draft immediately.
		wrapper
			.findAllComponents(ElInputNumber)
			.find((input) => input.attributes('data-test-id') === 'aggregate-weight')!
			.vm.$emit('update:modelValue', 4);
		await flushPromises();
		expect(wrapper.find('[data-test-id="measurement-preview"]').exists()).toBe(false);
		wrapper.unmount();
	});
	it('shows lease-qualified degraded quality then unavailable at exact expiry despite retained history and ready runtime', async () => {
		vi.useFakeTimers();
		const now = new Date('2026-10-15T12:00:00Z');
		vi.setSystemTime(now);
		mocks.properties = [
			{
				id: 'output',
				value: {
					value: 80,
					producer: {
						quality: 'degraded',
						sampledAt: now.toISOString(),
						evaluatedAt: now.toISOString(),
						expiresAt: new Date(now.getTime() + 1000).toISOString(),
					},
				},
			},
		];
		const wrapper = await mountEditor('output');
		expect(wrapper.text()).toContain('quality{"quality":"devicesVirtualPlugin.measurement.states.degraded');
		vi.advanceTimersByTime(1000);
		await wrapper.vm.$nextTick();
		expect(wrapper.text()).toContain('quality{"quality":"devicesVirtualPlugin.measurement.states.unavailable');
		expect(wrapper.text()).not.toContain('80');
		wrapper.unmount();
	});
});
