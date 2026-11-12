import { describe, expect, it, vi } from 'vitest';

import { type VueWrapper, mount } from '@vue/test-utils';

import { spacesStoreKey } from '../../../../modules/spaces/store/keys';
import { DevicesModbusPluginFraming, DevicesModbusPluginRegisterType } from '../../../../openapi.constants';
import { type IUseModbusDeviceWizard, useModbusDeviceWizard } from '../../composables/useModbusDeviceWizard';
import { CUSTOM_CAPABILITIES, pointBaseFor } from '../../lib/capabilities';
import { pointsFromRange } from '../../lib/points';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from '../../store/keys';

import ModbusWizardDeviceStep from './modbus-wizard-device-step.vue';

const spacesStore = { findAll: () => [], fetch: vi.fn().mockResolvedValue(undefined) };

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string) => key,
		}),
	};
});

vi.mock('../../../../common', async () => {
	const actual = await vi.importActual('../../../../common');

	return {
		...actual,
		useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
		useLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }),
		useBackend: () => ({ client: { POST: vi.fn(), PUT: vi.fn() } }),
		injectStoresManager: () => ({
			getStore: (key: symbol) => {
				if (key === modbusEndpointsStoreKey) return { findAll: () => [], fetch: vi.fn(), findById: () => null };
				if (key === modbusTemplatesStoreKey) return { catalog: null, fetch: vi.fn(), preview: vi.fn() };
				if (key === spacesStoreKey) return spacesStore;

				return { findByType: () => null };
			},
		}),
	};
});

const valveCapability = CUSTOM_CAPABILITIES.find((capability) => capability.key === 'valve.on')!;

const mountStep = (wizard: IUseModbusDeviceWizard) => mount(ModbusWizardDeviceStep, { props: { wizard } });

// The byte and word order selects offer big and little; every other option belongs to the category select.
const categoryValues = (wrapper: VueWrapper): unknown[] =>
	wrapper
		.findAllComponents({ name: 'ElOption' })
		.map((option) => option.props('value'))
		.filter((value) => value !== 'big' && value !== 'little');

describe('ModbusWizardDeviceStep', () => {
	it('offers the four Modbus categories and suggests one from the points', () => {
		const wizard = useModbusDeviceWizard();

		wizard.state.points = pointsFromRange(
			pointBaseFor(valveCapability, DevicesModbusPluginRegisterType.coil),
			{ registerType: null, start: 0, count: 1 },
			'Valve'
		);

		const wrapper = mountStep(wizard);

		expect(categoryValues(wrapper)).toEqual(['switcher', 'input_controller', 'sensor', 'valve']);
		expect(wizard.state.device.category).toBe('valve');
	});

	it('never offers or keeps the reserved generic category', () => {
		const wizard = useModbusDeviceWizard();

		wizard.state.device.category = 'generic';

		const wrapper = mountStep(wizard);

		expect(categoryValues(wrapper)).toEqual(['switcher', 'input_controller', 'sensor', 'valve']);
		expect(wizard.state.device.category).toBe('input_controller');
	});

	it('keeps offering the current and the template category, but not a generic template category', () => {
		const wizard = useModbusDeviceWizard();

		wizard.state.device.category = 'thermostat';
		wizard.state.templateDevice = {
			category: 'generic',
			manufacturer: 'Acme',
			model: 'R8',
			maxReadRegisters: null,
			maxReadBits: null,
			maxReadGap: null,
			endpointDefaults: { framing: DevicesModbusPluginFraming.tcp, port: 502 },
		};

		const wrapper = mountStep(wizard);

		expect(categoryValues(wrapper)).toEqual(['switcher', 'input_controller', 'sensor', 'valve', 'thermostat']);
		expect(wizard.state.device.category).toBe('thermostat');
	});

	it('hints at a fast poll interval when a point is a button event, and not for other points', () => {
		const hint = (capabilityKey: string, registerType: DevicesModbusPluginRegisterType) => {
			const wizard = useModbusDeviceWizard();

			wizard.state.points = pointsFromRange(
				pointBaseFor(CUSTOM_CAPABILITIES.find((capability) => capability.key === capabilityKey)!, registerType),
				{ registerType: null, start: 0, count: 1 },
				'Point'
			);

			return mountStep(wizard).find('.el-alert').exists();
		};

		expect(hint('button.event', DevicesModbusPluginRegisterType.discrete_input)).toBe(true);
		expect(hint('temperature.temperature', DevicesModbusPluginRegisterType.input_register)).toBe(false);
		expect(hint('switcher.on', DevicesModbusPluginRegisterType.coil)).toBe(false);
	});
});
