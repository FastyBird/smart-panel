import { ElMessageBox } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { DevicesModbusPluginDataType, DevicesModbusPluginRegisterType } from '../../../../openapi.constants';
import { type IUseModbusDeviceWizard, useModbusDeviceWizard } from '../../composables/useModbusDeviceWizard';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from '../../store/keys';

import ModbusWizardPointsStep from './modbus-wizard-points-step.vue';

const readPoints = vi.fn();
const write = vi.fn();
const flash = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

vi.mock('element-plus', async () => {
	const actual = await vi.importActual<typeof import('element-plus')>('element-plus');

	return {
		...actual,
		ElMessageBox: { ...actual.ElMessageBox, confirm: vi.fn() },
	};
});

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		useFlashMessage: () => flash,
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
	useModbusProbe: () => ({ read: vi.fn(), readPoints, write }),
}));

const mountStep = (wizard: IUseModbusDeviceWizard) =>
	mount(ModbusWizardPointsStep, {
		props: { wizard },
		global: { stubs: { teleport: true, transition: false } },
	});

const addRange = async (wrapper: ReturnType<typeof mountStep>, text: string) => {
	await wrapper.find('input[name="pointsAddress"]').setValue(text);
	await wrapper.find('[data-test-id="points-add"]').trigger('click');
};

const wizardWithEndpoint = (): IUseModbusDeviceWizard => {
	const wizard = useModbusDeviceWizard();

	wizard.state.endpointId = 'e1';
	wizard.state.unitId = 5;

	return wizard;
};

describe('ModbusWizardPointsStep', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		readPoints.mockResolvedValue({ ok: true, points: [], error: null, durationMs: 1 });
		write.mockResolvedValue({ ok: true, error: null, durationMs: 1 });
	});

	it('adds 32 rows from 0-31', async () => {
		const wizard = wizardWithEndpoint();
		wizard.setNotation('pdu');
		const wrapper = mountStep(wizard);

		await addRange(wrapper, '0-31');

		expect(wizard.state.points).toHaveLength(32);
		expect(wizard.state.points[0].read?.address).toBe(0);
		expect(wizard.state.points[31].read?.address).toBe(31);
		expect(wizard.state.points[0].write).toBeNull();
		expect(wizard.canContinue(2)).toBe(true);
	});

	it('shows the stored address next to modicon input', async () => {
		const wizard = wizardWithEndpoint();
		wizard.setNotation('modicon');
		const wrapper = mountStep(wizard);

		await wrapper.find('input[name="pointsAddress"]').setValue('00001');
		expect(wrapper.find('[data-test-id="points-add-preview"]').text()).toContain('"address":0');

		await wrapper.find('[data-test-id="points-add"]').trigger('click');

		const cell = wrapper.find('[data-test-id="point-address-read"]');

		expect(cell.text()).toContain('00001');
		expect(cell.text()).toContain('"address":0');
		// A "0xxxx" prefix is the coil table, whatever the table selector says.
		expect(wizard.state.points[0].read?.registerType).toBe(DevicesModbusPluginRegisterType.coil);
	});

	it('refuses to grow beyond 256 points', async () => {
		const wizard = wizardWithEndpoint();
		wizard.setNotation('pdu');
		const wrapper = mountStep(wizard);

		await addRange(wrapper, '0-199');
		await addRange(wrapper, '200-299');

		expect(wizard.state.points).toHaveLength(200);
		await flushPromises();

		expect(wrapper.find('[data-test-id="points-add-preview"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="points-add"]').attributes('disabled')).toBeDefined();

		await addRange(wrapper, '200-255');

		expect(wizard.state.points).toHaveLength(256);
	});

	it('stops auto refresh when the step unmounts', async () => {
		vi.useFakeTimers();

		try {
			const wizard = wizardWithEndpoint();
			wizard.setNotation('pdu');
			const wrapper = mountStep(wizard);

			await addRange(wrapper, '0-1');
			await wrapper.find('[data-test-id="points-auto-refresh"] input').setValue(true);
			await vi.advanceTimersByTimeAsync(4100);

			const calls = readPoints.mock.calls.length;

			expect(calls).toBeGreaterThanOrEqual(2);

			wrapper.unmount();
			await vi.advanceTimersByTimeAsync(20000);

			expect(readPoints).toHaveBeenCalledTimes(calls);
		} finally {
			vi.useRealTimers();
		}
	});

	it('does not continue without a read binding', () => {
		const wizard = wizardWithEndpoint();

		expect(wizard.canContinue(2)).toBe(false);
	});

	describe('test write', () => {
		const setup = async () => {
			const wizard = wizardWithEndpoint();
			wizard.setNotation('modicon');
			wizard.state.device.name = 'Cellar relays';
			const wrapper = mountStep(wizard);

			wizard.state.points = [
				{
					key: 'p1',
					name: 'Relay 1',
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
					read: binding(2),
					write: binding(2),
				},
			];
			await flushPromises();
			await wrapper.find('[data-test-id="point-test-write-p1"]').trigger('click');

			return { wizard, wrapper };
		};

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
		});

		it('does not write when the confirmation is cancelled', async () => {
			vi.mocked(ElMessageBox.confirm).mockRejectedValue('cancel');
			const { wrapper } = await setup();

			await wrapper.find('[data-test-id="points-test-write-run"]').trigger('click');
			await flushPromises();

			expect(ElMessageBox.confirm).toHaveBeenCalledTimes(1);
			expect(write).not.toHaveBeenCalled();
			expect(readPoints).not.toHaveBeenCalled();
		});

		it('writes once after confirmation and reads back', async () => {
			vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as never);
			const { wrapper } = await setup();

			await wrapper.find('[data-test-id="points-test-write-run"]').trigger('click');
			await flushPromises();

			const message = String(vi.mocked(ElMessageBox.confirm).mock.calls[0][0]);

			expect(message).toContain('"device":"Cellar relays"');
			expect(message).toContain('"unit":5');
			expect(message).toContain('"address":2');
			expect(message).toContain('"shown":"00003"');
			expect(message).toContain('"value":"false"');
			expect(write).toHaveBeenCalledTimes(1);
			expect(write.mock.calls[0][0]).toEqual({ endpoint_id: 'e1' });
			expect(write.mock.calls[0][1]).toBe(5);
			expect(write.mock.calls[0][3]).toBe(false);
			expect(readPoints).toHaveBeenCalledTimes(1);
		});

		it('does not read back when the write fails', async () => {
			vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as never);
			write.mockResolvedValue({ ok: false, error: { kind: 'timeout', exceptionCode: null, message: 'x' }, durationMs: 1 });
			const { wrapper } = await setup();

			await wrapper.find('[data-test-id="points-test-write-run"]').trigger('click');
			await flushPromises();

			expect(write).toHaveBeenCalledTimes(1);
			expect(readPoints).not.toHaveBeenCalled();
			expect(flash.error).toHaveBeenCalled();
		});

		it('does not confirm or write when the value input is cleared', async () => {
			vi.mocked(ElMessageBox.confirm).mockResolvedValue('confirm' as never);
			const { wizard, wrapper } = await setup();

			wizard.state.points[0].dataType = 'uint16';
			wizard.state.points[0].write!.dataType = DevicesModbusPluginDataType.uint16;
			await wrapper.find('[data-test-id="point-test-write-p1"]').trigger('click');
			await wrapper.find('input[name="testWriteValue"]').setValue('');
			await flushPromises();

			const run = wrapper.find('[data-test-id="points-test-write-run"]');

			expect(run.attributes('disabled')).toBeDefined();

			await run.trigger('click');
			await flushPromises();

			expect(ElMessageBox.confirm).not.toHaveBeenCalled();
			expect(write).not.toHaveBeenCalled();
		});

		it('names a new device when it has no name yet', async () => {
			vi.mocked(ElMessageBox.confirm).mockRejectedValue('cancel');
			const { wizard, wrapper } = await setup();

			wizard.state.device.name = '';
			await wrapper.find('[data-test-id="points-test-write-run"]').trigger('click');
			await flushPromises();

			expect(String(vi.mocked(ElMessageBox.confirm).mock.calls[0][0])).toContain('devicesModbusPlugin.wizard.points.testWrite.newDevice');
		});
	});
});
