import { ElOption } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import VirtualDewPointEditor from './virtual-dew-point-editor.vue';

const mocks = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn(), PUT: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../modules/devices/store/keys', () => ({
	devicesStoreKey: 'devices',
	channelsStoreKey: 'channels',
	channelsPropertiesStoreKey: 'properties',
}));
vi.mock('../../../common', () => ({
	useBackend: () => ({ client: mocks }),
	injectStoresManager: () => ({
		getStore: (key: string) => ({
			fetch: async () => undefined,
			findAll: () =>
				key === 'properties'
					? [
							{ id: 't', channel: 'tc', category: 'temperature', unit: '°C', permissions: ['ro'] },
							{ id: 'rh', channel: 'rhc', category: 'humidity', unit: '%', permissions: ['ro'] },
							{ id: 'forbidden-dew', channel: 'tc', category: 'temperature', unit: '°C', measurementQuantity: 'dew_point', permissions: ['ro'] },
						]
					: [],
			findById: (id: string) =>
				key === 'channels' ? { id, name: id, device: 'device', category: id === 'tc' ? 'temperature' : 'humidity' } : { id, name: 'Fixture' },
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
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.useRealTimers());
describe('dew point repair and diagnostic editor', () => {
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
