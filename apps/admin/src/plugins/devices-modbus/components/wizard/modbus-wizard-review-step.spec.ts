import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { RouteNames as DevicesRouteNames } from '../../../../modules/devices';
import { devicesStoreKey } from '../../../../modules/devices/store/keys';
import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import { DevicesModbusPluginByteOrder, DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../../openapi.constants';
import { type IUseModbusDeviceWizard, useModbusDeviceWizard } from '../../composables/useModbusDeviceWizard';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from '../../store/keys';

import ModbusWizardReviewStep from './modbus-wizard-review-step.vue';

const post = vi.fn();
const push = vi.fn();
const flash = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
const devicesStore = { get: vi.fn() };
const endpointsStore = {
	findAll: () => [],
	fetch: vi.fn(),
	findById: () => ({ id: 'e1', name: 'Gateway', host: '10.0.0.5', port: 502, framing: 'tcp' }),
};
const spacesStore = { findById: () => ({ id: 'r1', name: 'Kitchen' }), findAll: () => [], fetch: vi.fn() };

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

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		useFlashMessage: () => flash,
		useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
		useBackend: () => ({ client: { POST: post } }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === modbusEndpointsStoreKey) return endpointsStore;
				if (key === modbusTemplatesStoreKey) return { catalog: null, fetch: vi.fn(), preview: vi.fn() };
				if (key === devicesStoreKey) return devicesStore;
				if (key === spacesStoreKey) return spacesStore;

				return { findByType: () => null };
			},
		}),
	};
});

const binding = (address: number) => ({
	registerType: DevicesModbusPluginRegisterType.coil,
	address,
	dataType: DevicesModbusPluginDataType.bool,
	bit: null,
	byteOrder: null,
	wordOrder: null,
	scale: 1,
	offset: 0,
	invert: false,
	valueMap: null,
	writeFunction: null,
	pollIntervalMs: null,
	longPressMs: null,
});

const readyWizard = (): IUseModbusDeviceWizard => {
	const wizard = useModbusDeviceWizard();

	wizard.state.endpointId = 'e1';
	wizard.state.device.name = 'Relay box';
	wizard.state.device.category = 'switcher';
	wizard.state.device.roomId = 'r1';
	wizard.state.device.byteOrder = DevicesModbusPluginByteOrder.big;
	wizard.state.points = [
		{
			key: 'p1',
			name: 'Relay 1',
			channelId: null,
			propertyId: null,
			channelCategory: 'switcher',
			channelIdentifier: 'relay_1',
			propertyCategory: 'on',
			propertyIdentifier: null,
			propertyName: null,
			format: null,
			dataType: 'bool',
			permissions: ['rw'],
			staticValue: null,
			unit: null,
			read: binding(0),
			write: binding(0),
		},
	];

	return wizard;
};

const mountStep = (wizard: IUseModbusDeviceWizard) =>
	mount(ModbusWizardReviewStep, { props: { wizard }, global: { stubs: { teleport: true, transition: false } } });

describe('ModbusWizardReviewStep', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		devicesStore.get.mockResolvedValue({});
	});

	it('summarises the endpoint, the custom source and the bindings', () => {
		const wrapper = mountStep(readyWizard());

		expect(wrapper.find('[data-test-id="review-endpoint"]').text()).toContain('10.0.0.5:502');
		expect(wrapper.find('[data-test-id="review-source"]').text()).toContain('review.custom');
		expect(wrapper.findAll('[data-test-id="review-binding"]')).toHaveLength(2);
		expect(wrapper.find('[data-test-id="review-binding"]').text()).toContain('PDU 0');
	});

	it('disables create while pending and creates once', async () => {
		let resolvePost: (value: unknown) => void = () => undefined;

		post.mockReturnValue(new Promise((resolve) => (resolvePost = resolve)));

		const wrapper = mountStep(readyWizard());
		const button = wrapper.find('[data-test-id="review-create"]');

		await button.trigger('click');
		await button.trigger('click');

		expect(post).toHaveBeenCalledTimes(1);
		expect(button.attributes('disabled')).toBeDefined();

		resolvePost({ data: { data: { id: 'd1' } } });
		await flushPromises();

		expect(devicesStore.get).toHaveBeenCalledWith({ id: 'd1' });
		expect(flash.success).toHaveBeenCalledTimes(1);
		expect(push).toHaveBeenCalledWith({ name: DevicesRouteNames.DEVICE, params: { id: 'd1' } });
	});

	it('shows the backend reason and stays on the step', async () => {
		post.mockResolvedValue({ error: { error: { message: 'Channel is invalid' }, status: 400 }, response: { status: 400 } });

		const wizard = readyWizard();
		const wrapper = mountStep(wizard);

		await wrapper.find('[data-test-id="review-create"]').trigger('click');
		await flushPromises();

		const alert = wrapper.find('[data-test-id="review-error"]');

		expect(alert.exists()).toBe(true);
		expect(wizard.createError.value).toBeTruthy();
		expect(alert.text()).toContain(wizard.createError.value as string);
		expect(push).not.toHaveBeenCalled();
		expect(wrapper.find('[data-test-id="review-create"]').attributes('disabled')).toBeUndefined();
	});
});
