import { reactive } from 'vue';

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
		getStore: (key: string) => ({
			fetch: async () => {},
			findAll: () => (key === 'properties' ? mocks.properties : []),
			findById: (id: string) => (key === 'properties' ? mocks.properties.find((property) => (property as { id: string }).id === id) : null),
		}),
	}),
}));
const profiles = [
	{
		profile: 'illuminance',
		channel: 'illuminance',
		quantity: 'illuminance',
		unit: 'lx',
		data_types: ['float'],
		operators: ['mean', 'weighted_mean'],
		numeric_policy: true,
		output_step: 0.1,
	},
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

const evaluated = (value: number | boolean | null, profile = 'humidity', expiry: string | null = null) => ({
	...state,
	preview_result: {
		profile,
		value,
		quality: value === null ? 'unavailable' : 'degraded',
		reasons: value === null ? ['quorum_lost'] : ['outlier:binding2'],
		unit: profile === 'contact' ? null : profile === 'illuminance' ? 'lx' : '%',
		output_step: ['contact', 'temperature'].includes(profile) ? null : profile === 'illuminance' ? 0.1 : 1,
		evaluated_at: new Date().toISOString(),
		expires_at: expiry,
		sampled_at: new Date().toISOString(),
		inputs: state.inputs,
	},
});
const previewButton = (wrapper: Awaited<ReturnType<typeof mountEditor>>) =>
	wrapper.findAll('button').find((button) => button.text() === 'devicesVirtualPlugin.measurement.preview')!;
const saveButton = (wrapper: Awaited<ReturnType<typeof mountEditor>>) =>
	wrapper.findAll('button').find((button) => button.text() === 'devicesVirtualPlugin.measurement.save')!;
describe('backend-evaluated snapshot presentation', () => {
	it.each([
		[false, 'contact', 'devicesVirtualPlugin.measurement.notDetected'],
		[null, 'contact', '—'],
		[0, 'humidity', '0'],
		[12.3, 'illuminance', '12.3'],
		[1e-25, 'temperature', '1e-25'],
	] as const)('renders backend %s distinctly with its precision', async (value, profile, expected) => {
		const originalGet = mocks.GET.getMockImplementation()!;
		mocks.GET.mockImplementation(async (path: string) =>
			path.endsWith('aggregates/{id}')
				? { data: { data: { ...state, profile, operator: profile === 'contact' ? 'all' : 'weighted_mean' } } }
				: originalGet(path)
		);
		mocks.POST.mockResolvedValueOnce({ data: { data: evaluated(value, profile) } });
		const wrapper = await mountEditor('output');
		await previewButton(wrapper).trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain(expected);
		expect(wrapper.get('[data-test-id="aggregate-preview-quality"]').text()).toContain(value === null ? '.states.unavailable' : '.states.degraded');
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain('.evaluatedAt');
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain('.expiresAt');
		// Saved runtime diagnostics remain outside the independently evaluated draft snapshot.
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain(value === null ? '.states.quorum_lost' : '.states.outlier');
		wrapper.unmount();
	});
	it.each(['visible', 'in-flight'] as const)('invalidates a %s preview on source evidence changes without editing the draft', async (phase) => {
		const source = reactive({ id: 'outlier-id', channel: 'c', value: { value: 10, lastUpdated: 'first' } });
		mocks.properties = [source];
		const wrapper = await mountEditor('output');
		let resolve!: (response: unknown) => void;
		if (phase === 'visible') mocks.POST.mockResolvedValueOnce({ data: { data: evaluated(40) } });
		else
			mocks.POST.mockReturnValueOnce(
				new Promise((done) => {
					resolve = done;
				})
			);
		await previewButton(wrapper).trigger('click');
		await flushPromises();
		if (phase === 'visible') expect(wrapper.find('[data-test-id="measurement-preview"]').exists()).toBe(true);
		source.value.lastUpdated = 'second';
		await flushPromises();
		if (phase === 'in-flight') {
			resolve({ data: { data: evaluated(40) } });
			await flushPromises();
		}
		expect(wrapper.find('[data-test-id="measurement-preview"]').exists()).toBe(false);
		expect(saveButton(wrapper).attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
	it('removes an expired snapshot and disables saving at the evidence deadline', async () => {
		vi.useFakeTimers();
		mocks.POST.mockResolvedValueOnce({ data: { data: evaluated(40, 'humidity', new Date(Date.now() + 1000).toISOString()) } });
		const wrapper = await mountEditor('output');
		await previewButton(wrapper).trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain('40');
		expect(saveButton(wrapper).attributes('disabled')).toBeUndefined();
		vi.advanceTimersByTime(1000);
		await wrapper.vm.$nextTick();
		expect(wrapper.find('[data-test-id="measurement-preview"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('.previewExpired');
		expect(saveButton(wrapper).attributes('disabled')).toBeDefined();
		wrapper.unmount();
	});
});

describe('trusted numeric operator form', () => {
	it.each(['http', 'throw'] as const)('previews and saves a built-in despite a %s operator catalogue failure', async (failure) => {
		const stored = {
			output_property: 'output',
			schema_version: 1,
			quantity: 'temperature',
			unit: '°C',
			maximum_age_seconds: 30,
			revision: 1,
			graph_revision: 1,
			runtime_readiness: 'configured',
			quality: 'unavailable',
			current_value: null,
			errors: [],
			source: { id: 'binding', source_property: 'physical', source_identity: 'physical', quantity: 'temperature', unit: '°C' },
			policy: { operator: 'affine', scale: 1, offset: 0, inputRange: { minimum: 0, maximum: 100 }, outputRange: { minimum: 0, maximum: 100 } },
		};
		mocks.GET.mockImplementation(async (path: string) => {
			if (path.endsWith('numeric-operators')) {
				if (failure === 'throw') throw new Error('Network unavailable');
				return { error: { message: 'Unavailable' }, response: { status: 503 } };
			}
			return { data: { data: stored } };
		});
		const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform, outputId: 'output' } });
		await flushPromises();
		expect(wrapper.text()).not.toContain('.states.measurementCatalog');
		expect(previewButton(wrapper).attributes('disabled')).toBeUndefined();
		mocks.POST.mockResolvedValueOnce({ data: { data: { ...stored, preview_result: { input: 22, value: 22, error: null, qualified: false } } } });
		await previewButton(wrapper).trigger('click');
		await flushPromises();
		expect(saveButton(wrapper).attributes('disabled')).toBeUndefined();
		mocks.PUT.mockResolvedValueOnce({ data: { data: stored } });
		await saveButton(wrapper).trigger('click');
		await flushPromises();
		expect(mocks.PUT).toHaveBeenCalledWith(
			'/plugins/devices-virtual/producers/transforms/{id}',
			expect.objectContaining({ body: expect.objectContaining({ policy: expect.objectContaining({ operator: 'affine' }) }) })
		);
		wrapper.unmount();
	});

	it('renders actual bounded numeric inputs and canonical domains from the catalogue', async () => {
		mocks.GET.mockResolvedValue({
			data: {
				data: [
					{
						contractVersion: 1,
						name: 'offset',
						operatorId: '@fixture/operator:offset',
						operatorVersion: 1,
						input: { quantity: 'temperature', unit: '°C' },
						output: { quantity: 'temperature', unit: '°C' },
						inputRange: { minimum: -40, maximum: 100 },
						outputRange: { minimum: -50, maximum: 110 },
						parameters: { offset: { required: true, minimum: -10, maximum: 10 } },
					},
				],
			},
		});
		const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform } });
		await flushPromises();
		const operator = wrapper
			.findAllComponents(ElSelect)
			.find((select) => select.findAllComponents(ElOption).some((option) => option.props('value') === 'extension'))!;
		operator.vm.$emit('update:modelValue', 'extension');
		await flushPromises();
		const custom = wrapper.findAllComponents(ElSelect).find((select) => select.attributes('data-test-id') === 'numeric-operator')!;
		custom.vm.$emit('update:modelValue', '@fixture/operator:offset@1');
		custom.vm.$emit('change', '@fixture/operator:offset@1');
		await flushPromises();
		const input = wrapper.findAllComponents(ElInputNumber).find((field) => field.attributes('data-test-id') === 'numeric-parameter-offset')!;
		expect(input.props('min')).toBe(-10);
		expect(input.props('max')).toBe(10);
		expect(wrapper.get('[data-test-id="numeric-operator-domains"]').text()).toContain('temperature (°C)');
		wrapper.unmount();
	});
});

describe('measurement editor dedicated quantity routing', () => {
	it('opens persisted dew-point repair through the actual wrapper instead of the one-input transform editor', async () => {
		mocks.properties = [{ id: 'dew-output', measurementQuantity: 'dew_point' }];
		mocks.GET.mockResolvedValue({
			data: {
				data: {
					output_property: 'dew-output',
					revision: 1,
					graph_revision: 5,
					quantity: 'dew_point',
					unit: '°C',
					maximum_age_seconds: 30,
					maximum_skew_seconds: 2,
					quality: 'unavailable',
					current_value: null,
					expires_at: null,
					errors: ['missing'],
					sources: [
						{ role: 'dry_bulb', source_property: 't', source_identity: 't', errors: [] },
						{ role: 'relative_humidity', source_property: null, source_identity: 'retained-rh', errors: ['missing'] },
					],
				},
			},
		});
		const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform, outputId: 'dew-output' } });
		await flushPromises();
		expect(wrapper.find('[data-test-id="dew-point-editor"]').exists()).toBe(true);
		expect(wrapper.text()).toContain('retained-rh');
		expect(mocks.GET.mock.calls.map((call) => call[0])).toEqual(['/plugins/devices-virtual/producers/dew-points/{id}']);
		wrapper.unmount();
	});
});
