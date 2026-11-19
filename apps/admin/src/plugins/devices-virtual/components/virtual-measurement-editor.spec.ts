import { reactive } from 'vue';

import { ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, ElTooltip } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import DeviceWizardReviewChecks from '../../../modules/devices/components/wizard/device-wizard-review-checks.vue';
import { DevicesVirtualPluginDeviceMode } from '../../../openapi.constants';

import VirtualMeasurementEditor from './virtual-measurement-editor.vue';
import VirtualWizardReviewSection from './virtual-wizard-review-section.vue';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	flashError: vi.fn(),
	GET: vi.fn(),
	POST: vi.fn(),
	PUT: vi.fn(),
	properties: [] as unknown[],
	devices: [] as unknown[],
	channels: [] as unknown[],
	reads: { properties: 0, devices: 0, channels: 0 },
}));
vi.mock('vue-i18n', () => ({
	useI18n: () => ({ t: (key: string, params?: unknown) => `${key}${params ? JSON.stringify(params) : ''}`, te: () => true }),
}));
vi.mock('../../../modules/devices/store/keys', () => ({
	devicesStoreKey: 'devices',
	channelsStoreKey: 'channels',
	channelsPropertiesStoreKey: 'properties',
}));
vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ error: mocks.flashError }),
	useBackend: () => ({ client: mocks }),
	injectStoresManager: () => ({
		getStore: (key: string) => ({
			fetch: async () => {},
			findAll: () => {
				if (key === 'properties' || key === 'devices' || key === 'channels') mocks.reads[key]++;
				return key === 'properties' ? mocks.properties : key === 'devices' ? mocks.devices : key === 'channels' ? mocks.channels : [];
			},
			findById: (id: string) =>
				(key === 'properties' ? mocks.properties : key === 'devices' ? mocks.devices : key === 'channels' ? mocks.channels : []).find(
					(entry) => (entry as { id: string }).id === id
				) ?? null,
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
const mountEditor = async (outputId?: string, wizard = false) => {
	const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_aggregate, outputId, wizard } });
	await flushPromises();
	return wrapper;
};
beforeEach(() => {
	vi.resetAllMocks();
	mocks.reads = { properties: 0, devices: 0, channels: 0 };
	mocks.properties = [];
	mocks.devices = [];
	mocks.channels = [];
	mocks.GET.mockImplementation(async (path: string) => ({
		data: {
			data: path.endsWith('aggregate-profiles')
				? profiles
				: path.endsWith('/sources')
					? [
							{ property: 'allowed', channel: 'c', device: 'd' },
							{ property: 'other', channel: 'c', device: 'd' },
						]
					: state,
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
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain('.help.previewDescription');
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
		reasons: value === null ? ['quorum_lost', 'missing:binding', 'outlier:binding2'] : ['outlier:binding2'],
		unit: profile === 'contact' ? null : profile === 'illuminance' ? 'lx' : profile === 'temperature' ? '°C' : '%',
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
		const details = wrapper.find('[data-test-id="aggregate-preview-diagnostics"]');
		if (value === null) {
			expect(details.text()).toContain('.states.quorum_lost');
			expect(details.text()).not.toContain('.states.missing');
			expect(details.text()).not.toContain('.states.outlier');
		} else {
			expect(details.exists()).toBe(false);
		}
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

	it('opens a new conversion on the temperature profile and never carries temperature into the generic one', async () => {
		mocks.GET.mockResolvedValue({ data: { data: [] } });
		const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform } });
		await flushPromises();
		const profile = wrapper
			.findAllComponents(ElSelect)
			.find((select) => select.findAllComponents(ElOption).some((option) => option.props('value') === true))!;
		// An absent boolean prop is cast to `false`; the editor must still default to temperature.
		expect(profile.props('modelValue')).toBe(true);
		expect(wrapper.findAllComponents(ElInput).some((input) => input.props('modelValue') === 'temperature')).toBe(false);
		profile.vm.$emit('update:modelValue', false);
		await flushPromises();
		// The generic output slot rejects `temperature`, so the quantity and unit start empty.
		const values = wrapper.findAllComponents(ElInput).map((input) => input.props('modelValue'));
		expect(values).not.toContain('temperature');
		expect(values).not.toContain('°C');
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
		// Only the dew point configuration is loaded; the sensor reporting guidance is advisory and fetched separately.
		expect(mocks.GET.mock.calls.map((call) => call[0]).filter((path) => !path.includes('/source-reporting/'))).toEqual([
			'/plugins/devices-virtual/producers/dew-points/{id}',
		]);
		expect(mocks.GET).toHaveBeenCalledWith('/plugins/devices-virtual/producers/source-reporting/{id}', { params: { path: { id: 't' } } });
		wrapper.unmount();
	});

	describe('new aggregate defaults', () => {
		it('asks for every configured source until the user chooses a quorum', async () => {
			const wrapper = await mountEditor();
			const add = () =>
				wrapper
					.findAll('button')
					.find((button) => button.text().includes('.addInput'))!
					.trigger('click');
			const quorum = () =>
				wrapper.findAllComponents({ name: 'ElInputNumber' }).find((input) => input.attributes('data-test-id') === 'aggregate-quorum')!;
			await add();
			await add();
			await add();
			await flushPromises();
			expect(quorum().props('modelValue')).toBe(3);
			quorum().vm.$emit('update:modelValue', 2);
			quorum().vm.$emit('change', 2, 3);
			await add();
			await flushPromises();
			expect(quorum().props('modelValue')).toBe(2);
			wrapper.unmount();
		});
	});
});

const wizardSnapshot = (expiry: string) => {
	const snapshot = evaluated(22, 'temperature', expiry);
	snapshot.preview_result.inputs = [
		{
			id: 'first',
			source_property: 'allowed',
			source_identity: 'allowed',
			weight: 1,
			exclusion: null,
			age_seconds: 1,
			current_value: 21,
			unit: '°C',
		},
		{ id: 'second', source_property: 'other', source_identity: 'other', weight: 1, exclusion: null, age_seconds: 1, current_value: 23, unit: '°C' },
	] as unknown as typeof snapshot.preview_result.inputs;
	return snapshot;
};
const enterWizardReview = async (wrapper: Awaited<ReturnType<typeof mountEditor>>) => {
	wrapper.findComponent(ElInput).vm.$emit('update:modelValue', 'Combined temperature');
	await flushPromises();
	await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
	await wrapper.get('[data-source-id="allowed"]').trigger('click');
	await wrapper.get('[data-source-id="other"]').trigger('click');
	await flushPromises();
	await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
	await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
};
describe('measurement wizard automatic review', () => {
	beforeEach(() => vi.useFakeTimers());
	it('covers the whole wizard content while its catalogue loads and enables navigation when ready', async () => {
		const originalGet = mocks.GET.getMockImplementation()!;
		let finish!: (response: unknown) => void;
		mocks.GET.mockImplementation((path: string) =>
			path.endsWith('aggregate-profiles')
				? new Promise((resolve) => {
						finish = resolve;
					})
				: originalGet(path)
		);
		const wrapper = await mountEditor(undefined, true);
		const content = wrapper.get('.virtual-wizard-layout');
		expect(content.attributes('aria-busy')).toBe('true');
		expect(content.find('aside').exists()).toBe(true);
		expect(wrapper.get('[data-test-id="wizard-action-next"]').attributes('disabled')).toBeDefined();
		finish({ data: { data: profiles } });
		await flushPromises();
		expect(content.attributes('aria-busy')).toBe('false');
		expect(wrapper.get('[data-test-id="wizard-action-next"]').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});

	it('does not display the epoch timestamp or cached offline zero as a real reading', async () => {
		vi.useFakeTimers();
		mocks.devices = [
			{ id: 'offline', name: 'Offline Zigbee sensor', status: { online: false } },
			{ id: 'online', name: 'Online sensor', status: { online: true } },
		];
		mocks.channels = [
			{ id: 'c', device: 'offline' },
			{ id: 'c2', device: 'online' },
		];
		mocks.properties = [
			{ id: 'allowed', channel: 'c', value: { value: 0, lastUpdated: new Date(0).toISOString() } },
			{ id: 'other', channel: 'c2', value: { value: 0, lastUpdated: new Date(Date.now() - 7200000).toISOString() } },
		];
		const wrapper = await mountEditor(undefined, true);
		wrapper.getComponent(ElInput).vm.$emit('update:modelValue', 'Combined temperature');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		const readings = wrapper.getComponent(VirtualWizardSourcePicker).props('sources');
		expect(readings.find((source) => source.id === 'allowed')).toMatchObject({ online: false, reading: '—', age: '—' });
		expect(readings.find((source) => source.id === 'other')).toMatchObject({ online: true, reading: '0 °C', age: '2h' });
		wrapper.unmount();
	});

	it.each([DevicesVirtualPluginDeviceMode.sensor_aggregate, DevicesVirtualPluginDeviceMode.sensor_transform] as const)(
		'shows an online Zigbee cached value with unknown sample time in %s without inventing freshness',
		async (mode) => {
			vi.useFakeTimers();
			mocks.devices = [{ id: 'zigbee', name: 'Zigbee temperature sensor', type: 'devices-zigbee2mqtt', status: { online: true } }];
			mocks.channels = [{ id: 'c', device: 'zigbee', name: 'Temperature', category: 'temperature' }];
			mocks.properties = [
				{
					id: 'allowed',
					channel: 'c',
					name: 'Temperature',
					category: 'temperature',
					dataType: 'float',
					unit: '°C',
					permissions: ['ro'],
					value: { value: 16.8, lastUpdated: new Date(0).toISOString() },
				},
			];
			const originalGet = mocks.GET.getMockImplementation()!;
			mocks.GET.mockImplementation((path: string) =>
				path.endsWith('numeric-operators') ? Promise.resolve({ data: { data: [] } }) : originalGet(path)
			);
			const wrapper = mount(VirtualMeasurementEditor, { props: { mode, wizard: true } });
			await flushPromises();
			wrapper.getComponent(ElInput).vm.$emit('update:modelValue', 'Temperature');
			await flushPromises();
			await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
			await flushPromises();
			const picker = wrapper.getComponent(VirtualWizardSourcePicker);
			expect(picker.props('sources').find((source) => source.id === 'allowed')).toMatchObject({
				reading: '16.8 °C',
				age: 'devicesVirtualPlugin.wizard.layout.unknownSampleTime',
				readingHint: 'devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint',
				online: true,
			});
			await wrapper.get('[data-source-id="allowed"]').trigger('click');
			await flushPromises();
			expect(picker.props('selected')[0]).toMatchObject({ reading: '16.8 °C', age: 'devicesVirtualPlugin.wizard.layout.unknownSampleTime' });
			expect(wrapper.get('[data-test-id="wizard-selected-sources"]').text()).toContain('16.8 °C');
			expect(wrapper.find('[title="devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint"]').exists()).toBe(true);
			expect(mocks.POST).not.toHaveBeenCalled();
			wrapper.unmount();
		}
	);

	it('keeps a large numeric catalogue lazy until Sources and reads store collections a bounded number of times', async () => {
		vi.useFakeTimers();
		mocks.GET.mockResolvedValue({ data: { data: [] } });
		mocks.devices = [{ id: 'd', type: 'devices-shelly-ng', name: 'Multi-sensor' }];
		mocks.channels = [{ id: 'c', device: 'd', category: 'temperature', name: 'Measurements' }];
		mocks.properties = Array.from({ length: 256 }, (_, index) => ({
			id: `source-${index}`,
			channel: 'c',
			category: 'temperature',
			dataType: 'float',
			unit: '°C',
			permissions: ['ro'],
			name: `Temperature ${index}`,
		}));
		const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform, wizard: true } });
		await flushPromises();
		expect(wrapper.get('.virtual-wizard-layout').attributes('aria-busy')).toBe('false');
		expect(wrapper.findComponent(VirtualWizardSourcePicker).exists()).toBe(false);
		expect(mocks.reads.properties).toBe(0);
		wrapper.getComponent(ElInput).vm.$emit('update:modelValue', 'Converted temperature');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findAll('[data-source-id]')).toHaveLength(20);
		const catalogueRows = wrapper.getComponent(VirtualWizardSourcePicker).props('sources');
		await vi.advanceTimersByTimeAsync(1000);
		expect(wrapper.getComponent(VirtualWizardSourcePicker).props('sources')).toBe(catalogueRows);
		expect(mocks.reads.properties).toBeLessThanOrEqual(3);
		expect(mocks.reads.channels).toBeLessThanOrEqual(3);
		expect(mocks.reads.devices).toBeLessThanOrEqual(3);
		wrapper.findComponent(VirtualWizardSourcePicker).getComponent(ElInput).vm.$emit('update:modelValue', 'Temperature 255');
		await flushPromises();
		await wrapper.get('[data-source-id="source-255"]').trigger('click');
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(2);
		expect(wrapper.findComponent(VirtualWizardSourcePicker).exists()).toBe(false);
		wrapper.unmount();
	});
	it('keeps forms interactive during background calculation and ignores its late result after entering review', async () => {
		vi.useFakeTimers();
		const wrapper = await mountEditor(undefined, true);
		wrapper.findComponent(ElInput).vm.$emit('update:modelValue', 'Combined temperature');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-source-id="allowed"]').trigger('click');
		await wrapper.get('[data-source-id="other"]').trigger('click');
		await flushPromises();
		let finishBackground!: (response: unknown) => void;
		mocks.POST.mockReturnValueOnce(
			new Promise((resolve) => {
				finishBackground = resolve;
			})
		);
		await vi.advanceTimersByTimeAsync(350);
		const backgroundSignal = mocks.POST.mock.calls[0][1].signal as AbortSignal;
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('disabled')).toBe(false);
		expect(wrapper.text()).not.toContain('devicesVirtualPlugin.wizard.layout.refreshing');
		expect(wrapper.get('[data-test-id="wizard-action-next"]').attributes('disabled')).toBeUndefined();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(backgroundSignal.aborted).toBe(true);
		const reviewed = wizardSnapshot(new Date(Date.now() + 60000).toISOString());
		mocks.POST.mockResolvedValueOnce({ data: { data: reviewed } });
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain('22');
		const late = wizardSnapshot(new Date(Date.now() + 60000).toISOString());
		late.preview_result.value = 99;
		finishBackground({ data: { data: late } });
		await flushPromises();
		await vi.advanceTimersByTimeAsync(1000);
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain('22');
		expect(mocks.POST).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});

	it('uses short, distinguishable sensor names for weights and keeps full paths in tooltips', async () => {
		vi.useFakeTimers();
		mocks.devices = [{ id: 'd', name: 'Room sensor' }];
		mocks.channels = [
			{ id: 'c', device: 'd', name: 'Air' },
			{ id: 'c2', device: 'd', name: 'Surface' },
		];
		mocks.properties = [
			{ id: 'allowed', channel: 'c', name: null },
			{ id: 'other', channel: 'c2', name: null },
		];
		const originalGet = mocks.GET.getMockImplementation()!;
		mocks.GET.mockImplementation((path: string) =>
			path.endsWith('/sources')
				? Promise.resolve({
						data: {
							data: [
								{ property: 'allowed', channel: 'c', device: 'd' },
								{ property: 'other', channel: 'c2', device: 'd' },
							],
						},
					})
				: originalGet(path)
		);
		mocks.POST.mockResolvedValueOnce({ data: { data: wizardSnapshot(new Date(Date.now() + 60000).toISOString()) } });
		const wrapper = await mountEditor(undefined, true);
		await enterWizardReview(wrapper);
		wrapper.findAllComponents(VirtualWizardReviewSection)[2].vm.$emit('edit');
		await flushPromises();
		wrapper
			.findAllComponents(ElSelect)
			.find((select) => select.props('modelValue') === 'mean')!
			.vm.$emit('update:modelValue', 'weighted_mean');
		await flushPromises();
		const fields = wrapper.findAllComponents(ElFormItem).filter((field) => field.find('[data-test-id="aggregate-weight"]').exists());
		const labels = fields.map((field) => field.props('label'));
		expect(labels).toEqual([
			'devicesVirtualPlugin.measurement.weight · Room sensor · Air',
			'devicesVirtualPlugin.measurement.weight · Room sensor · Surface',
		]);
		expect(fields[0].getComponent(ElTooltip).props('content')).toBe('Room sensor / Air / allowed (°C)');
		fields[0].getComponent(ElInputNumber).vm.$emit('update:modelValue', 5);
		await flushPromises();
		expect(fields.map((field) => field.props('label'))).toEqual(labels);
		wrapper.unmount();
	});
	it('opens the chosen review section for editing and validates it before advancing', async () => {
		vi.useFakeTimers();
		mocks.POST.mockResolvedValueOnce({ data: { data: wizardSnapshot(new Date(Date.now() + 60000).toISOString()) } });
		const wrapper = await mountEditor(undefined, true);
		await enterWizardReview(wrapper);
		const sections = wrapper.findAllComponents(VirtualWizardReviewSection);
		expect(sections).toHaveLength(3);
		sections[0].vm.$emit('edit');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(0);
		wrapper.getComponent(ElInput).vm.$emit('update:modelValue', '');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(0);
		expect(wrapper.find('[data-test-id="wizard-action-create"]').exists()).toBe(false);
		expect(mocks.POST).toHaveBeenCalledTimes(1);
		wrapper.unmount();
	});
	it('keeps Next available to explain missing values at the current step', async () => {
		const wrapper = await mountEditor(undefined, true);
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(0);
		await vi.waitFor(() => expect(wrapper.find('.el-form-item__error').exists()).toBe(true));
		wrapper.findComponent(ElInput).vm.$emit('update:modelValue', 'Combined sensor');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(1);
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent({ name: 'DeviceWizardSteps' }).props('modelValue')).toBe(1);
		await vi.waitFor(() => expect(wrapper.text()).toContain('devicesModule.wizard.validation.minimumItems'));
		expect(mocks.POST).not.toHaveBeenCalled();
		wrapper.unmount();
	});
	it.each(['source update', 'expiry'])('saves the reviewed configuration directly after %s without changing the review', async (change) => {
		vi.useFakeTimers();
		const source = reactive({ id: 'allowed', channel: 'c', value: { value: 21, lastUpdated: 'first' } });
		mocks.properties = [source];
		mocks.POST.mockResolvedValueOnce({ data: { data: wizardSnapshot(new Date(Date.now() + 1000).toISOString()) } });
		const wrapper = await mountEditor(undefined, true);
		await enterWizardReview(wrapper);
		expect(mocks.POST).toHaveBeenCalledTimes(1);
		expect(wrapper.find('[data-test-id="wizard-action-preview"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain('22');
		const sourcesTable = () => wrapper.findAllComponents(VirtualWizardSourcePicker).find((picker) => picker.props('readOnly'))!;
		const sourceSnapshot = JSON.parse(JSON.stringify(sourcesTable().props('selected')));
		expect(sourcesTable().findAll('button')).toHaveLength(0);
		expect(sourcesTable().find('input').exists()).toBe(false);
		expect(wrapper.find('aside .el-table').exists()).toBe(false);
		if (change === 'source update') source.value.lastUpdated = 'second';
		else await vi.advanceTimersByTimeAsync(1000);
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain('22');
		expect(sourcesTable().props('selected')).toEqual(sourceSnapshot);
		expect(wrapper.find('[data-test-id="measurement-review-stale"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		const review = wrapper.get('[data-test-id="aggregate-preview-result"]').text();
		mocks.POST.mockResolvedValueOnce({
			data: { data: { configuration: state, device: { id: 'created-device' } } },
		});
		await wrapper.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(mocks.POST.mock.calls.map(([path]) => path)).toEqual([
			'/plugins/devices-virtual/producers/aggregates/draft-preview',
			'/plugins/devices-virtual/producers/aggregates',
		]);
		expect(wrapper.emitted('created')).toEqual([['created-device']]);
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toBe(review);
		expect(sourcesTable().props('selected')).toEqual(sourceSnapshot);
		expect(wrapper.find('[data-test-id="measurement-reasons"]').exists()).toBe(false);
		wrapper.unmount();
	});
	it('accepts offline sources and keeps review unchanged throughout saving', async () => {
		const source = reactive({ id: 'allowed', channel: 'c', value: { value: 21, lastUpdated: 'first' } });
		mocks.properties = [source];
		const snapshot = wizardSnapshot(new Date(Date.now() - 1000).toISOString());
		snapshot.preview_result.value = null;
		snapshot.preview_result.quality = 'unavailable';
		snapshot.preview_result.reasons = ['quorum_lost', 'offline:first', 'offline:second'];
		for (const input of snapshot.preview_result.inputs) input.exclusion = 'offline';
		mocks.POST.mockResolvedValueOnce({ data: { data: snapshot } });
		const wrapper = await mountEditor(undefined, true);
		await enterWizardReview(wrapper);
		const review = wrapper.get('[data-test-id="aggregate-preview-result"]').text();
		expect(review).toContain('—');
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain('unavailable');
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		let resolve!: (response: unknown) => void;
		mocks.POST.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		await wrapper.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		source.value.lastUpdated = 'second';
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toBe(review);
		expect(wrapper.text()).not.toContain('help.reviewLoading');
		expect(wrapper.findComponent(DeviceWizardReviewChecks).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="measurement-review-error"]').exists()).toBe(false);
		resolve({ data: { data: { configuration: state, device: { id: 'offline-device' } } } });
		await flushPromises();
		expect(mocks.POST.mock.calls.map(([path]) => path)).toEqual([
			'/plugins/devices-virtual/producers/aggregates/draft-preview',
			'/plugins/devices-virtual/producers/aggregates',
		]);
		expect(wrapper.emitted('created')).toEqual([['offline-device']]);
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toBe(review);
		wrapper.unmount();
	});
	it('keeps backend validation failures on Processing and permits retry before entering Review', async () => {
		mocks.POST.mockRejectedValueOnce(new Error('Backend unavailable'));
		const wrapper = await mountEditor(undefined, true);
		await enterWizardReview(wrapper);
		expect(wrapper.find('[data-test-id="wizard-action-create"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-next"]').exists()).toBe(true);
		expect(mocks.flashError).toHaveBeenCalledWith('Backend unavailable');
		expect(wrapper.find('.el-alert--error').exists()).toBe(false);
		mocks.POST.mockResolvedValueOnce({ data: { data: wizardSnapshot(new Date(Date.now() + 10000).toISOString()) } });
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toContain('22');
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});
	it.each([409, 503])('keeps the snapshot and reports a %s save failure as a notification', async (status) => {
		mocks.POST.mockResolvedValueOnce({ data: { data: wizardSnapshot(new Date(Date.now() + 10000).toISOString()) } });
		const wrapper = await mountEditor(undefined, true);
		await enterWizardReview(wrapper);
		const review = wrapper.get('[data-test-id="aggregate-preview-result"]').text();
		mocks.POST.mockResolvedValueOnce({ error: { message: 'Save refused' }, response: { status } });
		await wrapper.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('created')).toBeUndefined();
		expect(wrapper.get('[data-test-id="aggregate-preview-result"]').text()).toBe(review);
		expect(wrapper.findComponent(DeviceWizardReviewChecks).exists()).toBe(false);
		expect(mocks.flashError).toHaveBeenCalledWith(expect.stringContaining('measurementFailed'));
		expect(wrapper.find('.el-alert--error').exists()).toBe(false);
		expect(mocks.POST).toHaveBeenCalledTimes(2);
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled') !== undefined).toBe(status === 409);
		if (status === 409) {
			await wrapper
				.findAll('button')
				.find((button) => button.text().includes('measurement.reload'))!
				.trigger('click');
			await flushPromises();
			expect(wrapper.find('[data-test-id="wizard-action-create"]').exists()).toBe(false);
			mocks.POST.mockResolvedValueOnce({ data: { data: wizardSnapshot(new Date(Date.now() + 10000).toISOString()) } });
			await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
			await flushPromises();
			expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
			expect(wrapper.get('[data-test-id="measurement-summary"]').text()).toContain('Combined temperature');
		}
		wrapper.unmount();
	});
});

const transformState = () => ({
	output_property: 'output',
	schema_version: 1,
	quantity: 'temperature',
	unit: '°C',
	maximum_age_seconds: 60,
	revision: 0,
	graph_revision: 10,
	runtime_readiness: 'configured',
	quality: 'unavailable',
	current_value: null,
	errors: [],
	source: { id: 'binding', source_property: 'physical', source_identity: 'physical', quantity: 'temperature', unit: '°C' },
	policy: { operator: 'affine', scale: 10, offset: 0, inputRange: { minimum: 0, maximum: 10 }, outputRange: { minimum: 0, maximum: 100 } },
	preview_result: { input: 2, value: 20, error: null, qualified: false },
});
const enterTransformProcessing = async () => {
	if (!mocks.devices.length) {
		mocks.devices = [{ id: 'd', type: 'devices-shelly-ng', name: 'Physical sensor' }];
		mocks.channels = [{ id: 'c', device: 'd', category: 'temperature', name: 'Temperature' }];
		mocks.properties = [
			{ id: 'physical', channel: 'c', category: 'temperature', dataType: 'float', permissions: ['ro'], unit: '°C', name: 'Temperature' },
		];
	}

	const originalGet = mocks.GET.getMockImplementation()!;
	mocks.GET.mockImplementation((path: string) => (path.endsWith('numeric-operators') ? Promise.resolve({ data: { data: [] } }) : originalGet(path)));
	const wrapper = mount(VirtualMeasurementEditor, { props: { mode: DevicesVirtualPluginDeviceMode.sensor_transform, wizard: true } });
	await flushPromises();
	wrapper.findComponent(ElInput).vm.$emit('update:modelValue', 'Calibrated sensor');
	await flushPromises();
	await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
	await wrapper.get('[data-source-id="physical"]').trigger('click');
	await flushPromises();
	await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
	return wrapper;
};
const setConversionField = (wrapper: ReturnType<typeof mount>, field: string, value: number) => {
	wrapper
		.findAllComponents(ElInputNumber)
		.find((input) => input.attributes('data-test-id') === `conversion-${field}`)!
		.vm.$emit('update:modelValue', value);
};
describe('numeric conversion wizard guidance and review', () => {
	it.each([true, false])('uses the explicit review result instead of a stale background result (explicit success: %s)', async (succeeds) => {
		vi.useFakeTimers();
		const wrapper = await enterTransformProcessing();
		for (const [field, value] of Object.entries({ inputMinimum: 0, inputMaximum: 10, outputMinimum: 0, outputMaximum: 100, scale: 10, offset: 0 }))
			setConversionField(wrapper, field, value);
		const background = transformState();
		if (succeeds)
			background.preview_result = {
				input: 2,
				value: null,
				error: 'source_unavailable',
				qualified: false,
			} as unknown as typeof background.preview_result;
		mocks.POST.mockResolvedValueOnce({ data: { data: background } });
		await flushPromises();
		await vi.advanceTimersByTimeAsync(700);
		const reviewed = transformState();
		if (!succeeds)
			reviewed.preview_result = { input: 2, value: null, error: 'source_unavailable', qualified: false } as unknown as typeof reviewed.preview_result;
		mocks.POST.mockResolvedValueOnce({ data: { data: reviewed } });
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-test-id="measurement-processing-summary"]').exists()).toBe(succeeds);
		expect(wrapper.find('[data-test-id="wizard-action-next"]').exists()).toBe(!succeeds);
		wrapper.unmount();
	});
	it('shows specific valid and invalid settings, then permits creation after correction', async () => {
		const wrapper = await enterTransformProcessing();
		const fields = wrapper.findAllComponents(ElFormItem);
		expect(fields.find((field) => field.props('label') === 'devicesVirtualPlugin.measurement.inputMinimum')!.props('required')).toBe(true);
		expect(fields.find((field) => field.props('label') === 'devicesVirtualPlugin.measurement.sample')!.props('required')).toBeFalsy();
		setConversionField(wrapper, 'offset', 0);
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		const errors = wrapper.findAllComponents(ElFormItem).map((item) => item.props('error'));
		expect(errors).toContain('devicesVirtualPlugin.conversion.validation.rangeRequired');
		expect(errors).toContain('devicesVirtualPlugin.conversion.validation.requiredNumber');
		expect(wrapper.findComponent(DeviceWizardReviewChecks).exists()).toBe(false);
		expect(mocks.POST).not.toHaveBeenCalled();
		expect(wrapper.find('.el-empty').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-create"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="wizard-action-next"]').exists()).toBe(true);
		for (const [field, value] of Object.entries({ inputMinimum: 0, inputMaximum: 10, outputMinimum: 0, outputMaximum: 100, scale: 10 }))
			setConversionField(wrapper, field, value);
		mocks.POST.mockResolvedValueOnce({ data: { data: transformState() } });
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.findComponent(DeviceWizardReviewChecks).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="measurement-review-error"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="measurement-processing-summary"]').text()).toContain('devicesVirtualPlugin.measurement.offset');
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});
	it.each(['input_out_of_range', 'output_out_of_range'])('reviews and creates a valid policy despite %s in the test calculation', async (error) => {
		vi.useFakeTimers();
		const wrapper = await enterTransformProcessing();
		for (const [field, value] of Object.entries({
			inputMinimum: 0,
			inputMaximum: 10,
			outputMinimum: 0,
			outputMaximum: 1,
			scale: 10,
			offset: 0,
			sample: error === 'input_out_of_range' ? 20 : 2,
		}))
			setConversionField(wrapper, field, value);
		mocks.POST.mockResolvedValueOnce({ data: { data: { ...transformState(), preview_result: { input: 2, value: null, error, qualified: false } } } });
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(wrapper.find('[data-test-id="measurement-processing-summary"]').exists()).toBe(true);
		expect(wrapper.get('[data-test-id="measurement-preview"]').text()).toContain(`devicesVirtualPlugin.measurement.states.${error}`);
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		mocks.POST.mockResolvedValueOnce({ data: { data: { device: { id: 'converted' } } } });
		await wrapper.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(wrapper.emitted('created')).toEqual([['converted']]);
		expect(mocks.POST.mock.calls.map(([path]) => path)).toEqual([
			'/plugins/devices-virtual/producers/transforms/draft-preview',
			'/plugins/devices-virtual/producers/transforms',
		]);
	});

	it('coalesces edits before background evaluation without blocking fields or navigation', async () => {
		vi.useFakeTimers();
		const wrapper = await enterTransformProcessing();
		for (const [field, value] of Object.entries({ inputMinimum: 0, inputMaximum: 10, outputMinimum: 0, outputMaximum: 100, scale: 10, offset: 0 }))
			setConversionField(wrapper, field, value);
		await flushPromises();
		await vi.advanceTimersByTimeAsync(650);
		expect(mocks.POST).not.toHaveBeenCalled();
		setConversionField(wrapper, 'outputMaximum', 90);
		await flushPromises();
		await vi.advanceTimersByTimeAsync(650);
		expect(mocks.POST).not.toHaveBeenCalled();
		let finish!: (value: unknown) => void;
		mocks.POST.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await vi.advanceTimersByTimeAsync(50);
		expect(mocks.POST).toHaveBeenCalledTimes(1);
		expect(wrapper.get('[data-test-id="wizard-action-next"]').attributes('disabled')).toBeUndefined();
		expect(wrapper.get('[data-test-id="conversion-inputMinimum"] input').attributes('disabled')).toBeUndefined();
		finish({ data: { data: transformState() } });
		await flushPromises();
	});

	it('enables thermistor operators for a qualified raw-voltage Shelly source and explains their prerequisites', async () => {
		mocks.devices = [{ id: 'd', type: 'devices-shelly-ng', name: 'Probe' }];
		mocks.channels = [{ id: 'c', device: 'd', category: 'analog_input', identifier: `raw-voltage:voltmeter:1:${'a'.repeat(64)}`, name: 'Voltmeter' }];
		mocks.properties = [
			{
				id: 'physical',
				channel: 'c',
				category: 'value',
				dataType: 'float',
				identifier: 'voltage',
				unit: null,
				permissions: ['ro'],
				name: 'Raw voltage',
			},
		];
		const wrapper = await enterTransformProcessing();
		for (const operator of ['ntc_beta', 'steinhart_hart'])
			expect(
				wrapper
					.findAllComponents(ElOption)
					.find((option) => option.props('value') === operator)!
					.props('disabled')
			).toBe(false);
		const operator = wrapper.findAllComponents(ElSelect).find((select) => select.props('modelValue') === 'affine')!;
		operator.vm.$emit('update:modelValue', 'piecewise_linear');
		await flushPromises();
		expect(wrapper.text()).toContain('devicesVirtualPlugin.conversion.pointsHelp');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.conversion.operators.piecewise_linear');
		wrapper.unmount();
	});
});
