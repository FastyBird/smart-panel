import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IDevice } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices/store/keys';
import { modbusEndpointsStoreKey } from '../store/keys';

import ModbusDeviceSection from './modbus-device-section.vue';

const get = vi.fn();
const readPoints = vi.fn();
const push = vi.fn().mockResolvedValue(undefined);
const endpointsStore = {
	health: { e1: { state: 'connected' } } as Record<string, unknown>,
	findById: (id: string) => (id === 'e1' ? { id: 'e1', name: 'Gateway', host: '10.0.0.5', port: 502, framing: 'tcp' } : null),
	fetch: vi.fn(),
	fetchHealth: vi.fn(),
};
const channelsStore = { findForDevice: () => [{ id: 'c1' }] };
const propertiesStore = { findForChannel: () => [{ id: 'p1', name: 'Power', identifier: 'on', category: 'on' }] };

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');

	return { ...actual, useRouter: () => ({ push }) };
});

vi.mock('../composables/useModbusProbe', () => ({
	useModbusProbe: () => ({ readPoints }),
}));

vi.mock('../../../common', async () => {
	const actual = await vi.importActual('../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { GET: get } }),
		useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === modbusEndpointsStoreKey) return endpointsStore;
				if (key === channelsStoreKey) return channelsStore;
				if (key === channelsPropertiesStoreKey) return propertiesStore;

				return {};
			},
		}),
	};
});

const wireBinding = {
	id: 'b1',
	property_id: 'p1',
	device_id: 'd1',
	role: 'read',
	register_type: 'coil',
	address: 4,
	data_type: 'bool',
	bit: null,
	scale: 1,
	offset: 0,
	invert: false,
};

const device = (extra: Record<string, unknown> = {}): IDevice =>
	({
		id: 'd1',
		type: 'devices-modbus',
		endpointId: 'e1',
		unitId: 7,
		pollIntervalMs: 2500,
		byteOrder: 'big',
		wordOrder: 'little',
		templateId: 'relay-board',
		templateRevision: '3',
		...extra,
	}) as unknown as IDevice;

const mountSection = async (dev: IDevice) => {
	const wrapper = mount(ModbusDeviceSection, { props: { device: dev } });
	await flushPromises();

	return wrapper;
};

describe('ModbusDeviceSection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		get.mockResolvedValue({ data: { data: [wireBinding] } });
	});

	it('renders bindings from the api', async () => {
		const wrapper = await mountSection(device());

		expect(get).toHaveBeenCalledWith('/plugins/devices-modbus/devices/{id}/bindings', { params: { path: { id: 'd1' } } });
		expect(wrapper.get('[data-test-id="modbus-section-endpoint"]').text()).toBe('Gateway (10.0.0.5:502, devicesModbusPlugin.endpoints.framing.tcp)');
		expect(wrapper.get('[data-test-id="modbus-section-unit"]').text()).toBe('7');
		expect(wrapper.get('[data-test-id="modbus-section-poll"]').text()).toContain('2500');
		expect(wrapper.get('[data-test-id="modbus-section-template"]').text()).toContain('relay-board');
		expect(wrapper.get('[data-test-id="modbus-section-template"]').text()).toContain('"revision":"3"');
		expect(wrapper.text()).toContain('Power');
		expect(wrapper.text()).toContain('devicesModbusPlugin.section.bindings.roles.read');
		expect(wrapper.text()).toContain('devicesModbusPlugin.wizard.probe.registerType.coil');
		expect(wrapper.find('button[data-test-id="modbus-section-read-now"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Test write');
	});

	it('read now probes the saved endpoint and shows raw values', async () => {
		readPoints.mockResolvedValue({
			ok: true,
			points: [{ key: 'b1', raw: [1], value: true, error: null }],
			error: null,
			durationMs: 5,
		});
		const wrapper = await mountSection(device());

		await wrapper.get('[data-test-id="modbus-section-read-now"]').trigger('click');
		await flushPromises();

		expect(readPoints).toHaveBeenCalledTimes(1);
		const [target, unitId, points, orders] = readPoints.mock.calls[0]!;
		expect(target).toEqual({ endpoint_id: 'e1' });
		expect(unitId).toBe(7);
		expect(points).toHaveLength(1);
		expect(points[0]).toMatchObject({ key: 'b1', read: { registerType: 'coil', address: 4, dataType: 'bool', byteOrder: null } });
		expect(orders).toEqual({ byteOrder: 'big', wordOrder: 'little' });
		expect(wrapper.get('[data-test-id="modbus-section-raw-b1"]').text()).toBe('1');
		expect(wrapper.get('[data-test-id="modbus-section-decoded-b1"]').text()).toBe('true');
	});

	it('passes the device read limits and explains failed readings instead of showing raw messages', async () => {
		readPoints.mockResolvedValue({
			ok: false,
			points: [{ key: 'b1', raw: null, value: null, error: { kind: 'exception', exceptionCode: 2, message: 'raw backend text' } }],
			error: null,
			durationMs: 5,
		});
		const wrapper = await mountSection(device({ maxReadRegisters: 40, maxReadBits: null, maxReadGap: 3 }));

		await wrapper.get('[data-test-id="modbus-section-read-now"]').trigger('click');
		await flushPromises();

		expect(readPoints.mock.calls[0]![4]).toEqual({ maxReadRegisters: 40, maxReadBits: null, maxReadGap: 3 });
		expect(wrapper.get('[data-test-id="modbus-section-error-b1"]').text()).toBe('devicesModbusPlugin.wizard.probe.errors.illegalAddress');
		expect(wrapper.text()).not.toContain('raw backend text');
	});

	it('shows custom when the device has no template', async () => {
		const wrapper = await mountSection(device({ templateId: null, templateRevision: null, pollIntervalMs: null }));

		expect(wrapper.get('[data-test-id="modbus-section-template"]').text()).toBe('devicesModbusPlugin.section.templateCustom');
		expect(wrapper.get('[data-test-id="modbus-section-poll"]').text()).toBe('devicesModbusPlugin.section.pollDefault');
	});
});
