import { type ComputedRef, type Ref, computed, reactive, ref } from 'vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend } from '../../../common';
import { configPluginsStoreKey } from '../../../modules/config';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesModbusPluginByteOrder,
	type DevicesModbusPluginCreateDeviceOperation,
	DevicesModbusPluginFraming,
	type DevicesModbusPluginGetDeviceBindingsOperation,
	type DevicesModbusPluginUpdateDeviceStructureOperation,
} from '../../../openapi.constants';
import {
	DEVICES_MODBUS_PLUGIN_NAME,
	DEVICES_MODBUS_PLUGIN_PREFIX,
	DEVICES_MODBUS_TYPE,
	MODBUS_MAX_POLL_INTERVAL_MS,
	MODBUS_MIN_POLL_INTERVAL_MS,
} from '../devices-modbus.constants';
import type { AddressNotation } from '../lib/address-notation';
import { type ModbusDeviceChannelInput, deviceBindingFromWire, pointsFromDevice } from '../lib/device-points';
import { type ModbusPoint, pointsFromPreview, toCreateRequest, toUpdateRequest } from '../lib/points';
import { modbusEndpointsStoreKey, modbusTemplatesStoreKey } from '../store/keys';
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
	/** Framing and port the template expects of its endpoint. */
	endpointDefaults: { framing: DevicesModbusPluginFraming; port: number };
}

/** The template's endpoint expectation next to the saved endpoint the device will use. */
export interface IModbusWizardEndpointMismatch {
	expected: { framing: DevicesModbusPluginFraming; port: number };
	actual: { framing: DevicesModbusPluginFraming; port: number };
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

/** The device whose points the wizard edits (edit mode). */
export interface IModbusWizardEdit {
	deviceId: string;
	/** Category of each existing channel: the points update cannot change it, so a row of that channel keeps it. */
	channelCategories: Record<string, string>;
	/** Read limits of the device, used by the probe on the points step. */
	maxReadRegisters: number | null;
	maxReadBits: number | null;
	maxReadGap: number | null;
	/**
	 * Poll interval stored on the device; null when the device follows the plugin default, which the device step then
	 * shows. The update leaves it out until the user changes the shown value.
	 */
	storedPollIntervalMs: number | null;
}

export type ModbusWizardMode = 'create' | 'edit';

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
	/** Set by `loadDevice`; null while creating a device. */
	edit: IModbusWizardEdit | null;
}

/** `created` after a new device was posted, `saved` after the points of an existing one were updated. */
export type ModbusWizardSubmitState = 'idle' | 'submitting' | 'created' | 'saved' | 'error';

export interface IUseModbusDeviceWizard {
	state: IModbusWizardState;
	/** `edit` once `loadDevice` started: the endpoint and template steps are skipped and submit updates the points. */
	mode: Ref<ModbusWizardMode>;
	/** True while `loadDevice` runs. */
	loading: Ref<boolean>;
	/** Why the device could not be loaded for editing; the editor is not shown then. */
	loadError: Ref<string | null>;
	submitState: Ref<ModbusWizardSubmitState>;
	/** The reason the last submit failed, create or update. */
	createError: Ref<string | null>;
	/** Creates the device (create mode) or updates its points (edit mode); resolves to the device id. */
	submit: () => Promise<string>;
	/** Alias of `submit`, kept for existing callers. */
	create: () => Promise<string>;
	loadDevice: (id: string) => Promise<void>;
	/** Leaves edit mode for a fresh create wizard, e.g. when the view goes from the edit route to the add route. */
	startCreate: () => void;
	endpointForm: IUseModbusEndpointForm;
	applyingTemplate: Ref<boolean>;
	/** True while a new endpoint is being saved; the endpoint step is locked so the save cannot replace a newer choice. */
	savingEndpoint: Ref<boolean>;
	/**
	 * Set when the applied template expects another framing or port than the saved endpoint. The wizard never edits a
	 * saved endpoint on its own: its settings may be exactly what the user just tested, so the step only warns.
	 */
	endpointMismatch: ComputedRef<IModbusWizardEndpointMismatch | null>;
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
	const endpointsStore = storesManager.getStore(modbusEndpointsStoreKey);
	const config = storesManager.getStore(configPluginsStoreKey).findByType(DEVICES_MODBUS_PLUGIN_NAME) as
		| { defaultPollIntervalMs?: number }
		| null
		| undefined;

	const devicesStore = storesManager.getStore(devicesStoreKey);
	const channelsStore = storesManager.getStore(channelsStoreKey);
	const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

	const backend = useBackend();
	const endpointForm = useModbusEndpointForm();

	const initialState = (): IModbusWizardState => ({
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
		edit: null,
	});

	const state = reactive<IModbusWizardState>(initialState());

	const mode = ref<ModbusWizardMode>('create');
	const loading = ref<boolean>(false);
	const loadError = ref<string | null>(null);

	const applyingTemplate = ref<boolean>(false);
	const savingEndpoint = ref<boolean>(false);

	// The defaults last applied to each field. A field still holding its applied default has not been changed by
	// the user, so the next template may replace it; a differing value is the user's and is kept.
	const initialApplied = () => ({
		unitId: state.unitId,
		pollIntervalMs: state.device.pollIntervalMs,
		byteOrder: state.device.byteOrder,
		wordOrder: state.device.wordOrder,
		port: state.newEndpoint.port,
		framing: state.newEndpoint.framing,
		name: '',
	});

	const applied = initialApplied();

	const isValidUnitId = (unitId: number): boolean => Number.isInteger(unitId) && unitId >= 0 && unitId <= MAX_UNIT_ID;

	const canContinue = (step: number): boolean => {
		const editing = mode.value === 'edit';

		switch (step) {
			// An edited device keeps its endpoint and unit, and has no template step.
			case MODBUS_WIZARD_STEP.ENDPOINT:
				if (editing) {
					return true;
				}

				return isValidUnitId(state.unitId) && (state.endpointMode === 'existing' ? state.endpointId !== null : endpointForm.requiredFilled.value);
			case MODBUS_WIZARD_STEP.TEMPLATE:
				if (editing) {
					return true;
				}

				// A pending preview would replace the points after the user moved on.
				return !applyingTemplate.value && (state.template !== null || state.startedEmpty);
			case MODBUS_WIZARD_STEP.POINTS:
				// The backend refuses a device without a read binding.
				return state.points.length > 0 && state.points.some((point) => point.read !== null);
			case MODBUS_WIZARD_STEP.DEVICE:
				return (
					// The name is edited on the core device form, not here.
					(editing || state.device.name.trim() !== '') &&
					state.device.category !== null &&
					state.device.category !== '' &&
					// The create request needs a whole number of milliseconds within the backend's range.
					Number.isInteger(state.device.pollIntervalMs) &&
					state.device.pollIntervalMs >= MODBUS_MIN_POLL_INTERVAL_MS &&
					state.device.pollIntervalMs <= MODBUS_MAX_POLL_INTERVAL_MS
				);
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
			savingEndpoint.value = true;
			saving = endpointForm
				.submit()
				.then((saved) => {
					state.endpointId = saved.id;
					state.endpointMode = 'existing';

					return saved.id;
				})
				.finally(() => {
					saving = null;
					savingEndpoint.value = false;
				});
		}

		return saving;
	};

	// Bumped by every apply and by startEmpty; a preview that returns after a newer one started is ignored.
	let applyToken = 0;

	const applyTemplate = async (id: string): Promise<void> => {
		const token = ++applyToken;
		const overrides: IModbusTemplatePreviewOverrides = {};
		// A value that differs from the last applied default is the user's. It is sent as an override, and the preview
		// then echoes it back, so the echo must not be recorded as a template default: the next template would treat
		// the user's value as its own and replace it.
		const ownUnitId = state.unitId !== applied.unitId;
		const ownPollInterval = state.device.pollIntervalMs !== applied.pollIntervalMs;
		// The user can go back and change these while the preview is pending; a value changed meanwhile is kept.
		const unitIdBefore = state.unitId;
		const pollIntervalBefore = state.device.pollIntervalMs;

		if (ownUnitId) {
			overrides.unitId = state.unitId;
		}

		if (ownPollInterval) {
			overrides.pollIntervalMs = state.device.pollIntervalMs;
		}

		applyingTemplate.value = true;

		try {
			const preview = await templatesStore.preview(id, overrides);

			if (token !== applyToken) {
				return;
			}

			if (!ownUnitId) {
				if (state.unitId === unitIdBefore) {
					state.unitId = preview.unitId;
				}

				applied.unitId = preview.unitId;
			}

			if (preview.pollIntervalMs !== null && !ownPollInterval) {
				if (state.device.pollIntervalMs === pollIntervalBefore) {
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
				endpointDefaults: {
					framing: preview.endpointDefaults.framing as DevicesModbusPluginFraming,
					port: preview.endpointDefaults.port,
				},
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

	const createDevice = (): Promise<string> => {
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

	// Removes from the devices module stores what the points update deleted; the stores only add and update on a read.
	const forgetRemoved = (deviceId: string, kept: { id: string; properties?: { id: string }[] }[]): void => {
		const keptProperties = new Map(kept.map((channel) => [channel.id, new Set((channel.properties ?? []).map((property) => property.id))]));

		for (const channel of channelsStore.findForDevice(deviceId)) {
			const properties = keptProperties.get(channel.id);

			if (properties === undefined) {
				propertiesStore.unset({ channelId: channel.id });
				channelsStore.unset({ id: channel.id });

				continue;
			}

			for (const property of propertiesStore.findForChannel(channel.id)) {
				if (!properties.has(property.id)) {
					propertiesStore.unset({ id: property.id });
				}
			}
		}
	};

	// Replaces the points of the edited device. A second call while one is pending returns that outcome.
	let updating: Promise<string> | null = null;

	const updatePoints = (edit: IModbusWizardEdit): Promise<string> => {
		if (updating !== null) {
			return updating;
		}

		const fallback = 'Failed to update the points of the Modbus device.';

		if (state.device.category === null) {
			return Promise.reject(new Error(fallback));
		}

		let body: ReturnType<typeof toUpdateRequest>;

		try {
			body = toUpdateRequest({
				category: state.device.category,
				pollIntervalMs: state.device.pollIntervalMs,
				byteOrder: state.device.byteOrder,
				wordOrder: state.device.wordOrder,
				points: state.points,
			});
		} catch (error: unknown) {
			createError.value = error instanceof Error ? error.message : fallback;
			submitState.value = 'error';

			return Promise.reject(error);
		}

		// A device following the plugin default keeps doing so unless the user changed the shown default.
		if (edit.storedPollIntervalMs === null && state.device.pollIntervalMs === (config?.defaultPollIntervalMs ?? FALLBACK_POLL_INTERVAL_MS)) {
			delete body.data.poll_interval_ms;
		}

		submitState.value = 'submitting';
		createError.value = null;

		updating = (async (): Promise<string> => {
			try {
				const { data: responseData, error } = await backend.client.PUT(`/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/devices/{id}/structure`, {
					params: { path: { id: edit.deviceId } },
					body,
				});

				if (!responseData) {
					throw new Error(error ? getErrorReason<DevicesModbusPluginUpdateDeviceStructureOperation>(error, fallback) : fallback);
				}

				submitState.value = 'saved';

				forgetRemoved(edit.deviceId, (responseData.data.channels ?? []) as { id: string; properties?: { id: string }[] }[]);

				// The points are saved either way. A failed refresh leaves the device, its channels and properties behind
				// only until the next read; the device detail the wizard returns to reads them again.
				await devicesStore.get({ id: edit.deviceId }).catch((): void => undefined);

				return edit.deviceId;
			} catch (error: unknown) {
				createError.value = error instanceof Error ? error.message : fallback;
				submitState.value = 'error';

				throw error;
			} finally {
				updating = null;
			}
		})();

		return updating;
	};

	const submit = (): Promise<string> => {
		if (mode.value === 'create') {
			return createDevice();
		}

		// Edit mode never falls back to creating a device, not even when the device failed to load.
		return state.edit !== null ? updatePoints(state.edit) : Promise.reject(new Error('The Modbus device is not loaded.'));
	};

	// Bumped by every load; a load that finishes after a newer one started is ignored.
	let loadToken = 0;

	const loadDevice = async (id: string): Promise<void> => {
		const token = ++loadToken;
		const fallback = 'Failed to load the Modbus device.';

		// A template preview still pending is ignored once it returns: it must not replace the loaded device's points.
		applyToken++;
		applyingTemplate.value = false;

		mode.value = 'edit';
		loading.value = true;
		loadError.value = null;

		try {
			const [device, bindingsResponse] = await Promise.all([
				devicesStore.get({ id }),
				backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/devices/{id}/bindings`, { params: { path: { id } } }),
			]);

			if (token !== loadToken) {
				return;
			}

			if (!bindingsResponse.data) {
				throw new Error(
					bindingsResponse.error ? getErrorReason<DevicesModbusPluginGetDeviceBindingsOperation>(bindingsResponse.error, fallback) : fallback
				);
			}

			if (device.type !== DEVICES_MODBUS_TYPE) {
				throw new Error('The device is not a Modbus device.');
			}

			const modbus = device as typeof device & {
				endpointId?: string | null;
				unitId?: number | null;
				pollIntervalMs?: number | null;
				byteOrder?: DevicesModbusPluginByteOrder;
				wordOrder?: DevicesModbusPluginByteOrder;
				maxReadRegisters?: number | null;
				maxReadBits?: number | null;
				maxReadGap?: number | null;
			};

			const channels: ModbusDeviceChannelInput[] = channelsStore.findForDevice(id).map((channel) => ({
				id: channel.id,
				identifier: channel.identifier,
				name: channel.name,
				category: channel.category,
				properties: propertiesStore.findForChannel(channel.id).map((property) => ({
					id: property.id,
					identifier: property.identifier,
					name: property.name,
					category: property.category,
					dataType: property.dataType,
					permissions: [...property.permissions],
					unit: property.unit ?? null,
					format: property.format,
					value: property.value?.value ?? null,
				})),
			}));

			const points = pointsFromDevice(
				channels,
				bindingsResponse.data.data.map((item) => deviceBindingFromWire(item as unknown as Record<string, unknown>))
			);

			state.edit = {
				deviceId: id,
				channelCategories: Object.fromEntries(channels.map((channel) => [channel.id, channel.category])),
				maxReadRegisters: modbus.maxReadRegisters ?? null,
				maxReadBits: modbus.maxReadBits ?? null,
				maxReadGap: modbus.maxReadGap ?? null,
				storedPollIntervalMs: modbus.pollIntervalMs ?? null,
			};
			state.endpointMode = 'existing';
			state.endpointId = modbus.endpointId ?? null;
			state.unitId = modbus.unitId ?? DEFAULT_UNIT_ID;
			state.template = null;
			state.templateDevice = null;
			state.startedEmpty = false;
			state.points = points;
			state.device = {
				name: device.name,
				// The reserved category is never kept; the device step suggests one instead.
				category: device.category === 'generic' ? null : device.category,
				roomId: device.roomId ?? null,
				pollIntervalMs: modbus.pollIntervalMs ?? config?.defaultPollIntervalMs ?? FALLBACK_POLL_INTERVAL_MS,
				byteOrder: modbus.byteOrder ?? DevicesModbusPluginByteOrder.big,
				wordOrder: modbus.wordOrder ?? DevicesModbusPluginByteOrder.big,
			};
			state.step = MODBUS_WIZARD_STEP.POINTS;
			submitState.value = 'idle';
			createError.value = null;
		} catch (error: unknown) {
			if (token !== loadToken) {
				return;
			}

			state.edit = null;
			state.points = [];
			loadError.value = error instanceof Error && error.message !== '' ? error.message : fallback;
		} finally {
			if (token === loadToken) {
				loading.value = false;
			}
		}
	};

	const startCreate = (): void => {
		// A load or template preview still pending is ignored once it returns.
		loadToken++;
		applyToken++;

		Object.assign(state, initialState());
		Object.assign(applied, initialApplied());

		mode.value = 'create';
		loading.value = false;
		loadError.value = null;
		applyingTemplate.value = false;
		submitState.value = 'idle';
		createError.value = null;
		createdId = null;
	};

	const setEndpointMode = (endpointMode: IModbusWizardState['endpointMode']): void => {
		state.endpointMode = endpointMode;
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

	const endpointMismatch = computed<IModbusWizardEndpointMismatch | null>(() => {
		const expected = state.templateDevice?.endpointDefaults ?? null;

		if (expected === null || state.endpointMode !== 'existing' || state.endpointId === null) {
			return null;
		}

		const endpoint = endpointsStore.findById(state.endpointId);

		if (endpoint === null || (endpoint.framing === expected.framing && endpoint.port === expected.port)) {
			return null;
		}

		return { expected, actual: { framing: endpoint.framing, port: endpoint.port } };
	});

	return {
		state,
		mode,
		loading,
		loadError,
		submitState,
		createError,
		submit,
		create: submit,
		loadDevice,
		startCreate,
		endpointForm,
		applyingTemplate,
		savingEndpoint,
		endpointMismatch,
		canContinue,
		saveNewEndpoint,
		applyTemplate,
		startEmpty,
		setEndpointMode,
		setNotation,
		probeTarget,
	};
};
