import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import { devicesStoreKey } from '../../../modules/devices/store/keys';
import { modbusEndpointsStoreKey } from '../store/keys';

import ViewModbusEndpoints from './view-modbus-endpoints.vue';

const endpoint = { id: 'e1', name: 'Gateway', host: '10.0.0.5', port: 502, framing: 'tcp', enabled: true };
const endpointsStore = { data: {} as Record<string, unknown>, health: {}, fetch: vi.fn(), findAll: vi.fn(() => []), fetchHealth: vi.fn() };
const devicesStore = { fetch: vi.fn(), findAll: vi.fn(() => []) };

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});
vi.mock('vue-meta', () => ({ useMeta: vi.fn() }));
vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return { ...actual, useRouter: () => ({ push: vi.fn(), resolve: (to: unknown) => to }) };
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => (key === modbusEndpointsStoreKey ? endpointsStore : key === devicesStoreKey ? devicesStore : {}),
		}),
	};
});

vi.mock('../composables/useModbusEndpointsHealth', () => ({
	useModbusEndpointsHealth: () => ({ refresh: vi.fn(() => Promise.resolve()) }),
}));

const mountView = async () => {
	const wrapper = shallowMount(ViewModbusEndpoints, { global: { directives: { loading: {} } } });
	await flushPromises();

	return wrapper;
};

describe('ViewModbusEndpoints', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		endpointsStore.data = { e1: endpoint };
		endpointsStore.fetch.mockResolvedValue([endpoint]);
		devicesStore.fetch.mockResolvedValue([]);
	});

	it('keeps the endpoints manageable and warns when only the device list fails', async () => {
		devicesStore.fetch.mockRejectedValue(new Error('Devices unavailable'));

		const wrapper = await mountView();

		expect(wrapper.findComponent({ name: 'ModbusEndpointsTable' }).exists()).toBe(true);
		expect(wrapper.find('[data-test-id="modbus-endpoints-devices-failed"]').exists()).toBe(true);
	});

	it('shows the error instead of the table when the endpoints fail to load', async () => {
		endpointsStore.fetch.mockRejectedValue(new Error('Endpoints unavailable'));
		endpointsStore.data = {};

		const wrapper = await mountView();

		expect(wrapper.findComponent({ name: 'ModbusEndpointsTable' }).exists()).toBe(false);
		expect(wrapper.find('[data-test-id="modbus-endpoints-devices-failed"]').exists()).toBe(false);
		expect(wrapper.findAllComponents({ name: 'ElAlert' }).map((alert) => alert.props('title'))).toEqual(['Endpoints unavailable']);
	});

	it('shows the table without a warning when both lists load', async () => {
		const wrapper = await mountView();

		expect(wrapper.findComponent({ name: 'ModbusEndpointsTable' }).exists()).toBe(true);
		expect(wrapper.find('[data-test-id="modbus-endpoints-devices-failed"]').exists()).toBe(false);
	});
});
