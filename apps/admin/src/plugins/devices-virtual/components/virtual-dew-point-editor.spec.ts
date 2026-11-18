import { ElInput, ElOption } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import VirtualDewPointEditor from './virtual-dew-point-editor.vue';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';

const mocks = vi.hoisted(() => ({
	flashError: vi.fn(),
	GET: vi.fn(),
	POST: vi.fn(),
	PUT: vi.fn(),
	sourceValues: {} as Record<string, { value: number; lastUpdated: string | null }>,
}));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
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
			fetch: async () => undefined,
			findAll: () =>
				key === 'properties'
					? [
							{ id: 't', channel: 'tc', category: 'temperature', unit: '°C', permissions: ['ro'], value: mocks.sourceValues.t },
							{ id: 'rh', channel: 'rhc', category: 'humidity', unit: '%', permissions: ['ro'], value: mocks.sourceValues.rh },
							{ id: 'forbidden-dew', channel: 'tc', category: 'temperature', unit: '°C', measurementQuantity: 'dew_point', permissions: ['ro'] },
						]
					: [],
			findById: (id: string) =>
				key === 'properties'
					? {
							id,
							channel: id === 't' ? 'tc' : 'rhc',
							category: id === 't' ? 'temperature' : 'humidity',
							unit: id === 't' ? '°C' : '%',
							value: mocks.sourceValues[id],
							permissions: ['ro'],
						}
					: key === 'channels'
						? { id, name: id, device: 'device', category: id === 'tc' ? 'temperature' : 'humidity' }
						: { id, name: 'Fixture' },
		}),
	}),
}));
const response = () => ({
	output_property: 'output',
	revision: 1,
	graph_revision: 5,
	maximum_age_seconds: 30,
	maximum_skew_seconds: 2,
	quantity: 'dew_point',
	unit: '°C',
	quality: 'unavailable',
	current_value: null,
	expires_at: null,
	errors: ['missingRH', 'lineage'],
	sources: [
		{ role: 'dry_bulb', source_property: 't', source_identity: 't', age_seconds: 1, errors: [] },
		{ role: 'relative_humidity', source_property: null, source_identity: 'retained-rh', age_seconds: null, errors: ['missing'] },
	],
});

const chooseInputs = async (wrapper: ReturnType<typeof mount>) => {
	wrapper.getComponent(ElInput).vm.$emit('update:modelValue', 'Dew point');
	await flushPromises();
	await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
	await flushPromises();
	await wrapper.get('[data-source-id="t"]').trigger('click');
	await wrapper.get('[data-source-id="rh"]').trigger('click');
	await flushPromises();
};
const reviewSources = (wrapper: ReturnType<typeof mount>) =>
	wrapper.findAllComponents(VirtualWizardSourcePicker).find((picker) => picker.props('readOnly'))!;
beforeEach(() => {
	vi.resetAllMocks();
	mocks.sourceValues = {};
});
afterEach(() => vi.useRealTimers());
describe('dew point repair and diagnostic editor', () => {
	it('keeps cached source values visible with an unknown measurement time', async () => {
		vi.useFakeTimers();
		mocks.sourceValues = { t: { value: 16.8, lastUpdated: new Date(0).toISOString() }, rh: { value: 55, lastUpdated: null } };
		const wrapper = mount(VirtualDewPointEditor, { props: { wizard: true } });
		await flushPromises();
		await chooseInputs(wrapper);
		const selected = wrapper.getComponent(VirtualWizardSourcePicker).props('selected');
		expect(selected.map((source) => source.reading)).toEqual(['16.8 °C', '55 %']);
		expect(selected.every((source) => source.age === 'devicesVirtualPlugin.wizard.layout.unknownSampleTime')).toBe(true);
		expect(selected.every((source) => source.readingHint === 'devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint')).toBe(true);
		expect(mocks.POST).not.toHaveBeenCalled();
		wrapper.unmount();
	});

	it('validates before Review and keeps an unavailable calculation visible during creation', async () => {
		vi.useFakeTimers();
		mocks.POST.mockResolvedValueOnce({ data: { data: response() } });
		const wrapper = mount(VirtualDewPointEditor, { props: { wizard: true } });
		await flushPromises();
		wrapper.getComponent(ElInput).vm.$emit('update:modelValue', 'Dew point');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-source-id="t"]').trigger('click');
		await wrapper.get('[data-source-id="rh"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		const review = wrapper.get('[data-test-id="dew-point-preview"]').text();
		const sourcesBefore = JSON.parse(JSON.stringify(reviewSources(wrapper).props('selected')));
		expect(reviewSources(wrapper).findAll('button')).toHaveLength(0);
		expect(wrapper.find('aside .el-table').exists()).toBe(false);
		await vi.advanceTimersByTimeAsync(2000);
		expect(reviewSources(wrapper).props('selected')).toEqual(sourcesBefore);
		expect(review).toContain('unavailable');
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		let resolve!: (value: unknown) => void;
		mocks.POST.mockReturnValueOnce(
			new Promise((done) => {
				resolve = done;
			})
		);
		await wrapper.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="dew-point-preview"]').text()).toBe(review);
		resolve({ data: { data: { device: { id: 'created' } } } });
		await flushPromises();
		expect(wrapper.get('[data-test-id="dew-point-preview"]').text()).toBe(review);
		expect(wrapper.emitted('created')).toEqual([['created']]);
		expect(reviewSources(wrapper).props('selected')).toEqual(sourcesBefore);
		expect(mocks.POST.mock.calls.map(([path]) => path)).toEqual([
			'/plugins/devices-virtual/producers/dew-points/draft-preview',
			'/plugins/devices-virtual/producers/dew-points',
		]);
		wrapper.unmount();
	});

	it('ignores a late background preview and keeps both source roles in a read-only review', async () => {
		vi.useFakeTimers();
		const wrapper = mount(VirtualDewPointEditor, { props: { wizard: true } });
		await flushPromises();
		await chooseInputs(wrapper);
		let finish!: (value: unknown) => void;
		mocks.POST.mockReturnValueOnce(
			new Promise((resolve) => {
				finish = resolve;
			})
		);
		await vi.advanceTimersByTimeAsync(350);
		const signal = mocks.POST.mock.calls[0][1].signal as AbortSignal;
		expect(wrapper.get('[data-test-id="wizard-action-next"]').attributes('disabled')).toBeUndefined();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(signal.aborted).toBe(true);
		const valid = {
			...response(),
			quality: 'good',
			current_value: 13.9,
			errors: [],
			sources: response().sources.map((source) => ({
				...source,
				source_property: source.role === 'dry_bulb' ? 't' : 'rh',
				current_value: source.role === 'dry_bulb' ? 22 : 60,
				unit: source.role === 'dry_bulb' ? '°C' : '%',
				sampled_at: new Date(Date.now() + 1000).toISOString(),
				age_seconds: 1,
				errors: [],
			})),
		};
		mocks.POST.mockResolvedValueOnce({ data: { data: valid } });
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		const before = wrapper.get('[data-test-id="dew-point-preview"]').text();
		expect(before).toContain('13.9');
		expect(
			reviewSources(wrapper)
				.props('selected')
				.map((source) => source.reading)
		).toEqual(['22 °C', '60 %']);
		expect(
			reviewSources(wrapper)
				.props('selected')
				.map((source) => source.age)
		).toEqual(['1s', '1s']);
		finish({ data: { data: { ...valid, current_value: 0 } } });
		await flushPromises();
		await vi.advanceTimersByTimeAsync(1000);
		expect(wrapper.get('[data-test-id="dew-point-preview"]').text()).toBe(before);
		expect(wrapper.find('aside .el-table').exists()).toBe(false);
		expect(mocks.POST).toHaveBeenCalledTimes(2);
		wrapper.unmount();
	});
	it('keeps save errors visible without replacing review and allows explicit recalculation', async () => {
		vi.useFakeTimers();
		mocks.POST.mockResolvedValueOnce({ data: { data: response() } });
		const wrapper = mount(VirtualDewPointEditor, { props: { wizard: true } });
		await flushPromises();
		await chooseInputs(wrapper);
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		const before = JSON.parse(JSON.stringify(reviewSources(wrapper).props('selected')));
		mocks.POST.mockResolvedValueOnce({ error: { error: { details: { reason: 'Graph changed' } } } });
		await wrapper.get('[data-test-id="wizard-action-create"]').trigger('click');
		await flushPromises();
		expect(mocks.flashError).toHaveBeenCalledWith(expect.stringContaining('Graph changed'));
		expect(wrapper.find('[data-test-id="dew-point-review-error"]').exists()).toBe(false);
		expect(reviewSources(wrapper).props('selected')).toEqual(before);
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeDefined();
		mocks.POST.mockResolvedValueOnce({ data: { data: response() } });
		await wrapper
			.findAll('button')
			.find((button) => button.text().includes('layout.recalculate'))!
			.trigger('click');
		await flushPromises();
		expect(mocks.POST.mock.calls[2][1].body.configuration.expected_graph_revision).toBeUndefined();
		expect(wrapper.find('[data-test-id="dew-point-review-error"]').exists()).toBe(false);
		expect(wrapper.get('[data-test-id="wizard-action-create"]').attributes('disabled')).toBeUndefined();
		wrapper.unmount();
	});
	it('shows both retained source roles and exact blockers, with canonical candidates and separate preview diagnostics', async () => {
		mocks.GET.mockResolvedValue({ data: { data: response() } });
		mocks.POST.mockResolvedValue({ data: { data: response() } });
		const wrapper = mount(VirtualDewPointEditor, { props: { outputId: 'output' } });
		await flushPromises();
		expect(wrapper.text()).toContain('retained-rh');
		expect(wrapper.text()).toContain('missingRH, lineage');
		expect(wrapper.findAllComponents(ElOption).map((option) => option.props('value'))).toEqual(['t', 'rh']);
		const preview = wrapper.findAll('button').find((button) => button.text().includes('measurement.preview'))!;
		await preview.trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="dew-point-preview"]').text()).toContain('missingRH, lineage');
		expect(wrapper.text()).toContain('devicesVirtualPlugin.dewPoint.relative_humidity');
		wrapper.unmount();
	});
	it('withdraws response values at the original expiry and cannot renew them by wall-clock rollback', async () => {
		vi.useFakeTimers({ toFake: ['Date', 'performance', 'setInterval', 'clearInterval'] });
		vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
		const snapshot = {
			...response(),
			quality: 'good',
			current_value: 9.25,
			errors: [],
			expires_at: new Date(Date.now() + 1500).toISOString(),
			sources: response().sources.map((source) => ({
				...source,
				source_property: source.role === 'relative_humidity' ? 'rh' : 't',
				errors: [],
				contract_fingerprint: `fingerprint-${source.role}`,
			})),
		};
		mocks.GET.mockImplementation(async () => ({ data: { data: structuredClone(snapshot) } }));
		const wrapper = mount(VirtualDewPointEditor, { props: { outputId: 'output' } });
		await flushPromises();
		expect(wrapper.get('[data-test-id="dew-point-diagnostics"]').text()).toContain('9.25');
		await vi.advanceTimersByTimeAsync(2000);
		expect(wrapper.get('[data-test-id="dew-point-diagnostics"]').text()).not.toContain('9.25');
		vi.setSystemTime(new Date('2026-10-16T09:59:59Z'));
		await vi.advanceTimersByTimeAsync(1000);
		expect(wrapper.get('[data-test-id="dew-point-diagnostics"]').text()).toContain('unavailable');
		const reload = wrapper.findAll('button').find((button) => button.text().includes('measurement.reload'))!;
		await reload.trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="dew-point-diagnostics"]').text()).not.toContain('9.25');
		snapshot.expires_at = new Date(Date.now() + 10000).toISOString();
		await reload.trigger('click');
		await flushPromises();
		expect(wrapper.get('[data-test-id="dew-point-diagnostics"]').text()).toContain('9.25');
		wrapper.unmount();
	});
});
