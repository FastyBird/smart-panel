import { type Ref, reactive, ref } from 'vue';

import { injectStoresManager } from '../../../common';
import { configPluginsStoreKey } from '../../../modules/config';
import { DevicesModbusPluginByteOrder, DevicesModbusPluginFraming } from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_NAME } from '../devices-modbus.constants';
import type { AddressNotation } from '../lib/address-notation';
import { type ModbusPoint, pointsFromPreview } from '../lib/points';
import { modbusTemplatesStoreKey } from '../store/keys';
import type { IModbusTemplatePreviewOverrides } from '../store/templates.types';

import { type IModbusEndpointFormModel, type IUseModbusEndpointForm, useModbusEndpointForm } from './useModbusEndpointForm';
import type { ModbusProbeTarget } from './useModbusProbe';

export const MODBUS_WIZARD_STEP_COUNT = 5;

/** Wizard step indexes: Endpoint, Template, Points, Device, Review. */
export const MODBUS_WIZARD_STEP = { ENDPOINT: 0, TEMPLATE: 1, POINTS: 2, DEVICE: 3, REVIEW: 4 } as const;

const FALLBACK_POLL_INTERVAL_MS = 1000;
const DEFAULT_UNIT_ID = 1;
const MAX_UNIT_ID = 255;

/**
 * Device-level values of the applied template preview that are not part of the points. Task 10 passes them to
 * `toCreateRequest` as `manufacturer`, `model`, `maxReadRegisters`, `maxReadBits` and `maxReadGap`.
 */
export interface IModbusWizardTemplateDevice {
	manufacturer: string;
	model: string;
	maxReadRegisters: number | null;
	maxReadBits: number | null;
	maxReadGap: number | null;
}

export interface IModbusWizardTemplate {
	id: string;
	revision: string;
	/** The points exactly as the preview delivered them; `state.points` starts as an independent copy. */
	points: ModbusPoint[];
}

export interface IModbusWizardDevice {
	name: string;
	/** Category of the applied template; null until a template is applied (the points step suggests one). */
	category: string | null;
	roomId: string | null;
	pollIntervalMs: number;
	byteOrder: DevicesModbusPluginByteOrder;
	wordOrder: DevicesModbusPluginByteOrder;
}

export interface IModbusWizardState {
	step: number;
	endpointMode: 'existing' | 'new';
	endpointId: string | null;
	newEndpoint: IModbusEndpointFormModel;
	unitId: number;
	template: IModbusWizardTemplate | null;
	templateDevice: IModbusWizardTemplateDevice | null;
	/** True once the user chose "Start empty" on the template step. */
	startedEmpty: boolean;
	points: ModbusPoint[];
	device: IModbusWizardDevice;
	notation: AddressNotation;
}

export interface IUseModbusDeviceWizard {
	state: IModbusWizardState;
	endpointForm: IUseModbusEndpointForm;
	applyingTemplate: Ref<boolean>;
	canContinue: (step: number) => boolean;
	saveNewEndpoint: () => Promise<string>;
	applyTemplate: (id: string) => Promise<void>;
	startEmpty: () => void;
	setEndpointMode: (mode: IModbusWizardState['endpointMode']) => void;
	setNotation: (notation: AddressNotation) => void;
	probeTarget: () => ModbusProbeTarget | null;
}

export const useModbusDeviceWizard = (): IUseModbusDeviceWizard => {
	const storesManager = injectStoresManager();
	const templatesStore = storesManager.getStore(modbusTemplatesStoreKey);
	const config = storesManager.getStore(configPluginsStoreKey).findByType(DEVICES_MODBUS_PLUGIN_NAME) as
		| { defaultPollIntervalMs?: number }
		| null
		| undefined;

	const endpointForm = useModbusEndpointForm();

	const state = reactive<IModbusWizardState>({
		step: 0,
		endpointMode: 'existing',
		endpointId: null,
		newEndpoint: endpointForm.model,
		unitId: DEFAULT_UNIT_ID,
		template: null,
		templateDevice: null,
		startedEmpty: false,
		points: [],
		device: {
			name: '',
			category: null,
			roomId: null,
			pollIntervalMs: config?.defaultPollIntervalMs ?? FALLBACK_POLL_INTERVAL_MS,
			byteOrder: DevicesModbusPluginByteOrder.big,
			wordOrder: DevicesModbusPluginByteOrder.big,
		},
		notation: 'one_based',
	});

	const applyingTemplate = ref<boolean>(false);

	// The defaults last applied to each field. A field still holding its applied default has not been changed by
	// the user, so the next template may replace it; a differing value is the user's and is kept.
	const applied = {
		unitId: state.unitId,
		pollIntervalMs: state.device.pollIntervalMs,
		byteOrder: state.device.byteOrder,
		wordOrder: state.device.wordOrder,
		port: state.newEndpoint.port,
		framing: state.newEndpoint.framing,
		name: '',
	};

	const isValidUnitId = (unitId: number): boolean => Number.isInteger(unitId) && unitId >= 0 && unitId <= MAX_UNIT_ID;

	const canContinue = (step: number): boolean => {
		switch (step) {
			case MODBUS_WIZARD_STEP.ENDPOINT:
				return isValidUnitId(state.unitId) && (state.endpointMode === 'existing' ? state.endpointId !== null : endpointForm.requiredFilled.value);
			case MODBUS_WIZARD_STEP.TEMPLATE:
				return state.template !== null || state.startedEmpty;
			case MODBUS_WIZARD_STEP.POINTS:
			case MODBUS_WIZARD_STEP.DEVICE:
				// Placeholders until the points and device steps exist.
				return true;
			default:
				return false;
		}
	};

	let saving: Promise<string> | null = null;

	// Called when the user leaves step 1: device creation needs an endpoint id. It is a no-op once the endpoint exists,
	// so going back and forward never creates a second one.
	const saveNewEndpoint = (): Promise<string> => {
		if (state.endpointMode === 'existing' && state.endpointId !== null) {
			return Promise.resolve(state.endpointId);
		}

		if (saving === null) {
			saving = endpointForm
				.submit()
				.then((saved) => {
					state.endpointId = saved.id;
					state.endpointMode = 'existing';

					return saved.id;
				})
				.finally(() => {
					saving = null;
				});
		}

		return saving;
	};

	const applyTemplate = async (id: string): Promise<void> => {
		const overrides: IModbusTemplatePreviewOverrides = {};

		if (state.unitId !== applied.unitId) {
			overrides.unitId = state.unitId;
		}

		if (state.device.pollIntervalMs !== applied.pollIntervalMs) {
			overrides.pollIntervalMs = state.device.pollIntervalMs;
		}

		applyingTemplate.value = true;

		try {
			const preview = await templatesStore.preview(id, overrides);

			if (state.unitId === applied.unitId) {
				state.unitId = preview.unitId;
			}

			applied.unitId = preview.unitId;

			if (preview.pollIntervalMs !== null) {
				if (state.device.pollIntervalMs === applied.pollIntervalMs) {
					state.device.pollIntervalMs = preview.pollIntervalMs;
				}

				applied.pollIntervalMs = preview.pollIntervalMs;
			}

			if (state.device.byteOrder === applied.byteOrder) {
				state.device.byteOrder = preview.byteOrder;
			}

			if (state.device.wordOrder === applied.wordOrder) {
				state.device.wordOrder = preview.wordOrder;
			}

			applied.byteOrder = preview.byteOrder;
			applied.wordOrder = preview.wordOrder;

			if (state.endpointMode === 'new') {
				if (state.newEndpoint.port === applied.port) {
					state.newEndpoint.port = preview.endpointDefaults.port;
				}

				if (state.newEndpoint.framing === applied.framing) {
					endpointForm.setFraming(preview.endpointDefaults.framing as DevicesModbusPluginFraming);
				}

				applied.port = preview.endpointDefaults.port;
				applied.framing = preview.endpointDefaults.framing;
			}

			const suggestedName = `${preview.manufacturer} ${preview.model}`.trim();

			if (state.device.name === '' || state.device.name === applied.name) {
				state.device.name = suggestedName;
			}

			applied.name = suggestedName;

			state.device.category = preview.category;
			state.template = { id: preview.templateId, revision: preview.templateRevision, points: pointsFromPreview(preview) };
			state.templateDevice = {
				manufacturer: preview.manufacturer,
				model: preview.model,
				maxReadRegisters: preview.maxReadRegisters,
				maxReadBits: preview.maxReadBits,
				maxReadGap: preview.maxReadGap,
			};
			state.points = pointsFromPreview(preview);
			state.startedEmpty = false;
		} finally {
			applyingTemplate.value = false;
		}
	};

	const startEmpty = (): void => {
		state.template = null;
		state.templateDevice = null;
		state.points = [];
		state.device.category = null;
		state.startedEmpty = true;
	};

	const setEndpointMode = (mode: IModbusWizardState['endpointMode']): void => {
		state.endpointMode = mode;
	};

	const setNotation = (notation: AddressNotation): void => {
		state.notation = notation;
	};

	const probeTarget = (): ModbusProbeTarget | null => {
		if (state.endpointMode === 'existing') {
			return state.endpointId !== null ? { endpoint_id: state.endpointId } : null;
		}

		const host = state.newEndpoint.host.trim();

		if (host === '') {
			return null;
		}

		return {
			host,
			port: state.newEndpoint.port,
			framing: state.newEndpoint.framing,
			connect_timeout_ms: state.newEndpoint.connectTimeoutMs,
			request_timeout_ms: state.newEndpoint.requestTimeoutMs,
		};
	};

	return {
		state,
		endpointForm,
		applyingTemplate,
		canContinue,
		saveNewEndpoint,
		applyTemplate,
		startEmpty,
		setEndpointMode,
		setNotation,
		probeTarget,
	};
};
