import { computed, reactive, ref } from 'vue';

import { ElFormItem } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import type { IUseModbusDeviceWizard } from '../composables/useModbusDeviceWizard';
import type { ModbusPoint } from '../lib/points';

import ViewModbusWizard from './view-modbus-wizard.vue';

const mocks = vi.hoisted(() => ({ wizard: null as unknown as IUseModbusDeviceWizard, saveEndpoint: vi.fn() }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn(), resolve: () => ({ href: '/endpoints' }) }) }));
vi.mock('../../../modules/config', () => ({ configPluginsStoreKey: 'config' }));
vi.mock('../../../modules/devices', () => ({ RouteNames: { DEVICES: 'devices', DEVICE: 'device' } }));
vi.mock('../../../common', () => ({
	useLogger: () => ({ error: vi.fn() }),
	useFlashMessage: () => ({ error: vi.fn() }),
	injectStoresManager: () => ({
		getStore: () => ({
			findAll: () => [{ id: 'endpoint', name: 'LAN', host: '192.168.1.2', port: 502 }],
			fetch: vi.fn().mockResolvedValue(undefined),
		}),
	}),
}));
vi.mock('../composables/useModbusDeviceWizard', () => ({
	MODBUS_WIZARD_STEP: { ENDPOINT: 0, TEMPLATE: 1, POINTS: 2, DEVICE: 3, REVIEW: 4 },
	useModbusDeviceWizard: () => mocks.wizard,
}));
const render = () =>
	mount(ViewModbusWizard, {
		global: {
			stubs: {
				ModbusWizardProbePanel: true,
				ModbusWizardTemplateStep: true,
				ModbusWizardPointsStep: true,
				ModbusWizardReviewStep: true,
			},
		},
	});
beforeEach(() => {
	vi.clearAllMocks();
	const model = reactive({
		name: '',
		host: '',
		port: 502,
		framing: 'tcp',
		connectTimeoutMs: 1000,
		requestTimeoutMs: 1000,
		interRequestDelayMs: 0,
		maxInFlight: 1,
		enabled: true,
	});
	mocks.wizard = {
		state: reactive({
			step: 0,
			endpointMode: 'existing',
			endpointId: null,
			newEndpoint: model,
			unitId: 1,
			template: null,
			points: [],
			startedEmpty: false,
			device: { name: '', category: 'sensor', pollIntervalMs: 1000, byteOrder: 'big', wordOrder: 'big', roomId: null },
		}),
		mode: ref('create'),
		loading: ref(false),
		loadError: ref(null),
		submitState: ref('idle'),
		applyingTemplate: ref(false),
		savingEndpoint: ref(false),
		endpointForm: {
			model,
			fieldErrors: reactive({}),
			formAlert: ref(null),
			submitting: ref(false),
			maxInFlightDisabled: computed(() => false),
			setFraming: vi.fn(),
		},
		canContinue: () => true,
		saveNewEndpoint: mocks.saveEndpoint,
	} as unknown as IUseModbusDeviceWizard;
});
describe('Modbus wizard step validation', () => {
	it('shows a missing endpoint and invalid unit at their fields without advancing', async () => {
		const wrapper = render();
		await flushPromises();
		mocks.wizard.state.unitId = Number.NaN;
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.wizard.state.step).toBe(0);
		expect(wrapper.findAllComponents(ElFormItem).filter((field) => field.props('error'))).toHaveLength(2);
		expect(mocks.saveEndpoint).not.toHaveBeenCalled();
		mocks.wizard.state.endpointId = 'endpoint';
		mocks.wizard.state.unitId = 1;
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.wizard.state.step).toBe(1);
		wrapper.unmount();
	});
	it('accepts a custom long press on a button point, but keeps rejecting it on non-button points', async () => {
		mocks.wizard.state.step = 2;
		mocks.wizard.state.points = [
			{
				key: 'button',
				channelCategory: 'button',
				propertyCategory: 'event',
				dataType: 'enum',
				permissions: ['ev'],
				read: {
					registerType: 'discrete_input',
					address: 0,
					dataType: 'bool',
					bit: null,
					scale: 1,
					offset: 0,
					invert: false,
					valueMap: null,
					writeFunction: null,
					longPressMs: 1200,
				},
				write: null,
			},
		] as unknown as ModbusPoint[];
		const wrapper = render();
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.wizard.state.step).toBe(3);
		mocks.wizard.state.step = 2;
		mocks.wizard.state.points[0].channelCategory = 'binary_input';
		mocks.wizard.state.points[0].propertyCategory = 'active';
		mocks.wizard.state.points[0].dataType = 'bool';
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.wizard.state.step).toBe(2);
		wrapper.unmount();
	});
	it('validates a new endpoint before persisting it and device settings before Review', async () => {
		mocks.wizard.state.endpointMode = 'new';
		const wrapper = render();
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.saveEndpoint).not.toHaveBeenCalled();
		expect(wrapper.findAllComponents(ElFormItem).filter((field) => field.props('error'))).toHaveLength(2);
		mocks.wizard.state.step = 3;
		mocks.wizard.state.device.pollIntervalMs = Number.NaN;
		await flushPromises();
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.wizard.state.step).toBe(3);
		expect(wrapper.findAllComponents(ElFormItem).filter((field) => field.props('error'))).toHaveLength(2);
		mocks.wizard.state.device.name = 'Board';
		mocks.wizard.state.device.pollIntervalMs = 1000;
		await wrapper.get('[data-test-id="wizard-action-next"]').trigger('click');
		await flushPromises();
		expect(mocks.wizard.state.step).toBe(4);
		wrapper.unmount();
	});
});
