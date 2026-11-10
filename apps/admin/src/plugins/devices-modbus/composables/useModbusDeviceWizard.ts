import { type Ref, reactive, ref } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import { configPluginsStoreKey } from '../../../modules/config';
import { DevicesModbusPluginByteOrder, type DevicesModbusPluginCreateDeviceOperation, DevicesModbusPluginFraming } from '../../../openapi.constants';
import { DEVICES_MODBUS_PLUGIN_NAME, DEVICES_MODBUS_PLUGIN_PREFIX } from '../devices-modbus.constants';
import type { AddressNotation } from '../lib/address-notation';
import { type ModbusPoint, pointsFromPreview, toCreateRequest } from '../lib/points';
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
	/** The template's own category; the device step keeps offering it after the user picks another one. */
	category: string;
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

export type ModbusWizardSubmitState = 'idle' | 'submitting' | 'created' | 'error';

export interface IUseModbusDeviceWizard {
	state: IModbusWizardState;
	submitState: Ref<ModbusWizardSubmitState>;
	createError: Ref<string | null>;
	create: () => Promise<string>;
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

	const backend = useBackend();
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
				// The backend refuses a device without a read binding.
				return state.points.length > 0 && state.points.some((point) => point.read !== null);
			case MODBUS_WIZARD_STEP.DEVICE:
				return state.device.name.trim() !== '' && state.device.category !== null && state.device.category !== '';
			default:
				return false;
		}
	};

	const submitState = ref<ModbusWizardSubmitState>('idle');
	const createError = ref<string | null>(null);

	let saving: Promise<string> | null = null;

	// Called when the user leaves step 1: device creation needs an endpoint id. It is a no-op once the endpoint exists,
	// so going back and forward never creates a second one.
	const saveNewEndpoint = (): Promise<string> => {
		if (state.endpointMode === 'existing') {
			return state.endpointId !== null ? Promise.resolve(state.endpointId) : Promise.reject(new Error('No endpoint is selected.'));
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

	// Bumped by every apply and by startEmpty; a preview that returns after a newer one started is ignored.
	let applyToken = 0;

	const applyTemplate = async (id: string): Promise<void> => {
		const token = ++applyToken;
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

			if (token !== applyToken) {
				return;
			}

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
				category: preview.category,
				manufacturer: preview.manufacturer,
				model: preview.model,
				maxReadRegisters: preview.maxReadRegisters,
				maxReadBits: preview.maxReadBits,
				maxReadGap: preview.maxReadGap,
			};
			state.points = pointsFromPreview(preview);
			state.startedEmpty = false;
		} finally {
			if (token === applyToken) {
				applyingTemplate.value = false;
			}
		}
	};

	const startEmpty = (): void => {
		applyToken++;
		applyingTemplate.value = false;

		if (state.device.name === applied.name) {
			state.device.name = '';
		}

		applied.name = '';
		state.template = null;
		state.templateDevice = null;
		state.points = [];
		state.device.category = null;
		state.startedEmpty = true;
	};

	// Posts the whole structure in one request; Modbus devices are created only through this plugin route. A second call
	// while one is pending, or after the device exists, returns that outcome instead of posting again.
	let creating: Promise<string> | null = null;
	let createdId: string | null = null;

	const create = (): Promise<string> => {
		if (createdId !== null) {
			return Promise.resolve(createdId);
		}

		if (creating !== null) {
			return creating;
		}

		const fallback = 'Failed to create the Modbus device.';

		if (state.endpointId === null || state.device.category === null) {
			return Promise.reject(new Error(fallback));
		}

		let body: ReturnType<typeof toCreateRequest>;

		try {
			body = toCreateRequest({
				name: state.device.name.trim(),
				category: state.device.category,
				roomId: state.device.roomId,
				endpointId: state.endpointId,
				unitId: state.unitId,
				pollIntervalMs: state.device.pollIntervalMs,
				byteOrder: state.device.byteOrder,
				wordOrder: state.device.wordOrder,
				points: state.points,
				template: state.template,
				manufacturer: state.templateDevice?.manufacturer,
				model: state.templateDevice?.model,
				maxReadRegisters: state.templateDevice?.maxReadRegisters,
				maxReadBits: state.templateDevice?.maxReadBits,
				maxReadGap: state.templateDevice?.maxReadGap,
			});
		} catch (error: unknown) {
			createError.value = error instanceof Error ? error.message : fallback;
			submitState.value = 'error';

			return Promise.reject(error);
		}

		submitState.value = 'submitting';
		createError.value = null;

		creating = (async (): Promise<string> => {
			try {
				const { data: responseData, error } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/devices`, {
					body,
				});

				if (!responseData) {
					throw new Error(error ? getErrorReason<DevicesModbusPluginCreateDeviceOperation>(error, fallback) : fallback);
				}

				submitState.value = 'created';
				createdId = responseData.data.id;

				return responseData.data.id;
			} catch (error: unknown) {
				createError.value = error instanceof Error ? error.message : fallback;
				submitState.value = 'error';

				throw error;
			} finally {
				creating = null;
			}
		})();

		return creating;
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
		submitState,
		createError,
		create,
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
