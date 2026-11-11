import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { type IUseModbusDeviceWizard, useModbusDeviceWizard } from '../../composables/useModbusDeviceWizard';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from '../../store/keys';

import ModbusWizardProbePanel from './modbus-wizard-probe-panel.vue';

const read = vi.fn();

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		useBackend: () => ({ client: { POST: vi.fn() } }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === modbusEndpointsStoreKey) return { findAll: () => [], fetch: vi.fn() };
				if (key === modbusTemplatesStoreKey) return { catalog: null, fetch: vi.fn(), preview: vi.fn() };

				return { findByType: () => null };
			},
		}),
	};
});

vi.mock('../../composables/useModbusProbe', () => ({
	useModbusProbe: () => ({ read, readPoints: vi.fn(), write: vi.fn() }),
}));

const run = async (wizard: IUseModbusDeviceWizard) => {
	const wrapper = mount(ModbusWizardProbePanel, { props: { wizard }, global: { stubs: { teleport: true, transition: false } } });

	await wrapper.find('[data-test-id="probe-run"]').trigger('click');
	await flushPromises();

	return wrapper;
};

describe('ModbusWizardProbePanel', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		read.mockResolvedValue({ ok: true, values: [1], error: null, durationMs: 4 });
	});

	const formErrors = (wrapper: ReturnType<typeof mountPanel>): string[] =>
		wrapper
			.findAllComponents({ name: 'ElFormItem' })
			.map((item) => item.props('error') as string | undefined)
			.filter((error): error is string => typeof error === 'string');

	const mountPanel = () => {
		const wizard = useModbusDeviceWizard();

		wizard.state.endpointId = 'e1';

		return mount(ModbusWizardProbePanel, { props: { wizard }, global: { stubs: { teleport: true, transition: false } } });
	};

	it('refuses an address range instead of reading only its first address', async () => {
		const wrapper = mountPanel();

		await wrapper.find('input[name="probeAddress"]').setValue('1-10');
		await wrapper.find('[data-test-id="probe-run"]').trigger('click');
		await flushPromises();

		expect(formErrors(wrapper)).toContain('devicesModbusPlugin.wizard.points.editor.singleAddress');
		expect(wrapper.find('[data-test-id="probe-run"]').attributes('disabled')).toBeDefined();
		expect(read).not.toHaveBeenCalled();
	});

	it('does not run with a cleared count', async () => {
		const wrapper = mountPanel();

		wrapper.findComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', null);
		await flushPromises();
		await wrapper.find('[data-test-id="probe-run"]').trigger('click');
		await flushPromises();

		expect(formErrors(wrapper).some((error) => error.startsWith('devicesModbusPlugin.wizard.probe.count.invalid'))).toBe(true);
		expect(wrapper.find('[data-test-id="probe-run"]').attributes('disabled')).toBeDefined();
		expect(read).not.toHaveBeenCalled();
	});

	it.each([
		['the selected endpoint', (wizard: IUseModbusDeviceWizard) => (wizard.state.endpointId = 'e2')],
		['the unit id', (wizard: IUseModbusDeviceWizard) => (wizard.state.unitId = 9)],
		[
			'the mode and host of a new endpoint',
			(wizard: IUseModbusDeviceWizard) => {
				wizard.state.endpointMode = 'new';
				wizard.state.newEndpoint.host = '10.0.0.9';
			},
		],
	])('clears the previous result when %s changes', async (_label, change) => {
		const wizard = useModbusDeviceWizard();

		wizard.state.endpointId = 'e1';

		const wrapper = await run(wizard);

		expect(read).toHaveBeenCalledTimes(1);
		expect(wrapper.find('.el-alert').exists()).toBe(true);

		change(wizard);
		await flushPromises();

		expect(wrapper.find('.el-alert').exists()).toBe(false);
	});

	it('drops a result that arrives after the target changed', async () => {
		let resolveRead: (value: unknown) => void = () => undefined;
		read.mockReturnValue(new Promise((resolve) => (resolveRead = resolve)));

		const wizard = useModbusDeviceWizard();
		wizard.state.endpointId = 'e1';

		const wrapper = mount(ModbusWizardProbePanel, { props: { wizard }, global: { stubs: { teleport: true, transition: false } } });

		await wrapper.find('[data-test-id="probe-run"]').trigger('click');

		wizard.state.unitId = 9;
		await flushPromises();

		resolveRead({ ok: true, values: [1], error: null, durationMs: 4 });
		await flushPromises();

		expect(wrapper.find('.el-alert').exists()).toBe(false);
	});
});
