import { type ComputedRef, type Reactive, computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { tryOnMounted, tryOnUnmounted } from '@vueuse/core';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useFlashMessage, useLogger } from '../../../common';
import { FormResult, type FormResultType } from '../../../modules/devices';
import {
	DevicesModuleDeviceCategory,
	type DevicesZigbee2mqttPluginAdoptWizardOperation,
	type DevicesZigbee2mqttPluginCreateWizardOperation,
	type DevicesZigbee2mqttPluginDisableWizardPermitJoinOperation,
	type DevicesZigbee2mqttPluginEnableWizardPermitJoinOperation,
	type DevicesZigbee2mqttPluginGetWizardOperation,
} from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
import { DevicesZigbee2mqttApiException } from '../devices-zigbee2mqtt.exceptions';
import type { IZ2mWizardAdoptionResult, IZ2mWizardDevice, IZ2mWizardSession } from '../schemas/wizard.types';
import {
	type ApiWizardAdoption,
	type ApiWizardSession,
	transformWizardAdoptRequest,
	transformWizardAdoptionResponse,
	transformWizardSessionResponse,
} from '../utils/wizard.transformers';

import { useFriendlyNameHumanizer } from './useFriendlyNameHumanizer';

export const isAdoptableStatus = (status: IZ2mWizardDevice['status']): boolean =>
	status === 'ready' || status === 'already_registered';

export interface IUseDevicesWizard {
	session: ComputedRef<IZ2mWizardSession | null>;
	devices: ComputedRef<IZ2mWizardDevice[]>;
	selectedDevices: ComputedRef<IZ2mWizardDevice[]>;
	permitJoin: ComputedRef<IZ2mWizardSession['permitJoin']>;
	bridgeOnline: ComputedRef<boolean>;
	formResult: ComputedRef<FormResultType>;
	selected: Reactive<Record<string, boolean>>;
	categoryByIeee: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	nameByIeee: Reactive<Record<string, string>>;
	adoptionResults: ComputedRef<IZ2mWizardAdoptionResult[]>;
	canContinue: ComputedRef<boolean>;
	startSession: () => Promise<void>;
	refreshSession: () => Promise<void>;
	endSession: () => Promise<void>;
	enablePermitJoin: () => Promise<void>;
	disablePermitJoin: () => Promise<void>;
	adoptSelected: () => Promise<IZ2mWizardAdoptionResult[]>;
	categoryOptions: (device: IZ2mWizardDevice) => { value: DevicesModuleDeviceCategory; label: string }[];
}

const DEFAULT_PERMIT_JOIN: IZ2mWizardSession['permitJoin'] = {
	active: false,
	expiresAt: null,
	remainingSeconds: 0,
};

export const useDevicesWizard = (): IUseDevicesWizard => {
	const { t } = useI18n();
	const backend = useBackend();
	const logger = useLogger();
	const flashMessage = useFlashMessage();
	const { humanize } = useFriendlyNameHumanizer();

	const session = ref<IZ2mWizardSession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IZ2mWizardAdoptionResult[]>([]);
	const selected = reactive<Record<string, boolean>>({});
	const categoryByIeee = reactive<Record<string, DevicesModuleDeviceCategory | null>>({});
	const nameByIeee = reactive<Record<string, string>>({});
	const readyAddresses = new Set<string>();

	let pollingTimer: number | null = null;

	// Generation counter — incremented on every session boundary (start / end). Polling
	// captures the generation at schedule time; if the generation changed by the time the
	// awaited refresh resolves, the response is dropped instead of resurrecting the session.
	// This prevents an in-flight `refreshSession` started before `endSession` from writing
	// back to `session.value` after deletion and looping on 404s.
	let sessionGeneration = 0;

	const devices = computed<IZ2mWizardDevice[]>(() =>
		orderBy(
			session.value?.devices ?? [],
			[(device) => (isAdoptableStatus(device.status) ? 0 : 1), (device) => device.ieeeAddress],
			['asc', 'asc']
		)
	);

	const selectedDevices = computed<IZ2mWizardDevice[]>(() =>
		devices.value.filter((device) => selected[device.ieeeAddress] === true && isAdoptableStatus(device.status))
	);

	const canContinue = computed<boolean>(() => {
		if (selectedDevices.value.length === 0) {
			return false;
		}

		return selectedDevices.value.every((device) => {
			const name = nameByIeee[device.ieeeAddress];
			const category = categoryByIeee[device.ieeeAddress];

			return typeof name === 'string' && name.trim().length > 0 && category !== null && category !== undefined;
		});
	});

	const permitJoin = computed<IZ2mWizardSession['permitJoin']>(() => session.value?.permitJoin ?? DEFAULT_PERMIT_JOIN);

	const bridgeOnline = computed<boolean>(() => session.value?.bridgeOnline ?? false);

	const stopPolling = (): void => {
		if (pollingTimer !== null) {
			window.clearTimeout(pollingTimer);
			pollingTimer = null;
		}
	};

	const schedulePoll = (): void => {
		stopPolling();

		const scheduledGeneration = sessionGeneration;

		pollingTimer = window.setTimeout(async () => {
			pollingTimer = null;

			try {
				await refreshSession();
			} catch {
				// Polling failures are non-fatal — keep trying so transient hiccups recover automatically.
			} finally {
				// If endSession or startSession ran during the awaited refresh, the generation
				// has bumped and rescheduling here would either resurrect a deleted session or
				// race with the new one. Bail out and let the new session manage its own polls.
				if (sessionGeneration === scheduledGeneration && session.value !== null) {
					schedulePoll();
				}
			}
		}, 1_000);
	};

	const applySession = (nextSession: IZ2mWizardSession): void => {
		const previousDevices = session.value?.devices ?? [];

		session.value = nextSession;

		for (const device of nextSession.devices) {
			const previousDevice = previousDevices.find((item) => item.ieeeAddress === device.ieeeAddress);
			const becameAlreadyRegistered =
				previousDevice !== undefined && previousDevice.status !== 'already_registered' && device.status === 'already_registered';
			const wasPreviouslyReady = readyAddresses.has(device.ieeeAddress);

			// `ready` devices are pre-selected so the user can adopt new pairings in a single step.
			// `already_registered` devices stay deselected — the user must opt in explicitly to override
			// the category/name the main service auto-adopted them with.
			if (selected[device.ieeeAddress] === undefined) {
				selected[device.ieeeAddress] = device.status === 'ready';
			} else if (becameAlreadyRegistered) {
				selected[device.ieeeAddress] = false;
			} else if (device.status === 'ready' && !wasPreviouslyReady && previousDevice === undefined) {
				selected[device.ieeeAddress] = true;
			}

			// Pre-fill the category dropdown so the wizard never lands on an empty selector for
			// already-adopted devices: prefer the existing DB category over the descriptor's
			// suggestion.
			const initialCategory = device.registeredDeviceCategory ?? device.suggestedCategory;

			if (categoryByIeee[device.ieeeAddress] === undefined || (categoryByIeee[device.ieeeAddress] === null && initialCategory !== null)) {
				categoryByIeee[device.ieeeAddress] = initialCategory;
			}

			// Pre-fill an editable name from the existing registration, otherwise humanize the
			// zigbee2mqtt friendlyName so the user sees a sensible default instead of a slug.
			if (nameByIeee[device.ieeeAddress] === undefined) {
				nameByIeee[device.ieeeAddress] = device.registeredDeviceName ?? humanize(device.friendlyName);
			}

			if (device.status === 'ready') {
				readyAddresses.add(device.ieeeAddress);
			}
		}
	};

	const resetSessionScopedState = (): void => {
		for (const key of Object.keys(selected)) {
			delete selected[key];
		}
		for (const key of Object.keys(categoryByIeee)) {
			delete categoryByIeee[key];
		}
		for (const key of Object.keys(nameByIeee)) {
			delete nameByIeee[key];
		}
		readyAddresses.clear();
		adoptionResults.value = [];
	};

	const startSession = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;
		sessionGeneration += 1;
		const startGeneration = sessionGeneration;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard`);

		// If endSession (or another startSession) raced ahead while POST was in-flight,
		// drop this response so we don't resurrect a session the caller has already torn down.
		if (sessionGeneration !== startGeneration) {
			return;
		}

		if (typeof responseData !== 'undefined') {
			resetSessionScopedState();
			applySession(transformWizardSessionResponse((responseData as { data: ApiWizardSession }).data));
			formResult.value = FormResult.OK;
			schedulePoll();

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesZigbee2mqttPluginCreateWizardOperation>(error, t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' }))
			: t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' });

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);
		logger.error('Failed to start z2m wizard session');

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	const refreshSession = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		const refreshGeneration = sessionGeneration;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
			params: {
				path: {
					id: session.value.id,
				},
			},
		});

		// Discard the response if endSession ran during the await — otherwise applySession
		// would write the stale snapshot back into session.value, resurrecting a deleted
		// session and triggering a 404 loop the next time polling fires.
		if (sessionGeneration !== refreshGeneration) {
			return;
		}

		if (typeof responseData !== 'undefined') {
			applySession(transformWizardSessionResponse((responseData as { data: ApiWizardSession }).data));

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesZigbee2mqttPluginGetWizardOperation>(error, t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' }))
			: t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' });

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	const endSession = async (): Promise<void> => {
		// Bump the generation BEFORE awaiting anything so any in-flight refreshSession
		// (or its scheduling tail) sees the change and bails out instead of writing back.
		sessionGeneration += 1;
		stopPolling();

		const currentSession = session.value;

		if (currentSession === null) {
			resetSessionScopedState();

			return;
		}

		try {
			await backend.client.DELETE(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
				params: {
					path: {
						id: currentSession.id,
					},
				},
			});
		} catch (error: unknown) {
			logger.warn('Failed to cleanly end z2m wizard session', error);
		} finally {
			session.value = null;
			resetSessionScopedState();
		}
	};

	const enablePermitJoin = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		formResult.value = FormResult.WORKING;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/permit-join`, {
			params: {
				path: {
					id: session.value.id,
				},
			},
		});

		if (typeof responseData !== 'undefined') {
			applySession(transformWizardSessionResponse((responseData as { data: ApiWizardSession }).data));
			formResult.value = FormResult.OK;

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesZigbee2mqttPluginEnableWizardPermitJoinOperation>(error, t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' }))
			: t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' });

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	const disablePermitJoin = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		formResult.value = FormResult.WORKING;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.DELETE(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/permit-join`, {
			params: {
				path: {
					id: session.value.id,
				},
			},
		});

		if (typeof responseData !== 'undefined') {
			applySession(transformWizardSessionResponse((responseData as { data: ApiWizardSession }).data));
			formResult.value = FormResult.OK;

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesZigbee2mqttPluginDisableWizardPermitJoinOperation>(error, t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' }))
			: t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' });

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	const adoptSelected = async (): Promise<IZ2mWizardAdoptionResult[]> => {
		if (session.value === null) {
			return [];
		}

		formResult.value = FormResult.WORKING;

		const userSelections = selectedDevices.value.slice();

		const adoptDevices = userSelections.map((device) => ({
			ieeeAddress: device.ieeeAddress,
			name: (nameByIeee[device.ieeeAddress] || humanize(device.friendlyName) || device.ieeeAddress).trim(),
			category: (categoryByIeee[device.ieeeAddress] ?? DevicesModuleDeviceCategory.generic) as DevicesModuleDeviceCategory,
		}));

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}/adopt`, {
			params: {
				path: {
					id: session.value.id,
				},
			},
			body: transformWizardAdoptRequest(adoptDevices) as never,
		});

		if (typeof responseData !== 'undefined') {
			const results = transformWizardAdoptionResponse((responseData as { data: ApiWizardAdoption }).data);

			adoptionResults.value = results;
			formResult.value = results.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;

			return results;
		}

		const errorReason = error
			? getErrorReason<DevicesZigbee2mqttPluginAdoptWizardOperation>(error, t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' }))
			: t('devicesZigbee2mqttPlugin.messages.devices.notAdopted', { device: '' });

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	const categoryOptions = (device: IZ2mWizardDevice): { value: DevicesModuleDeviceCategory; label: string }[] => {
		const categorySet = new Set<DevicesModuleDeviceCategory>(device.categories);

		// Always include the device's existing registered category, even if the descriptor no
		// longer reports it — otherwise the dropdown would render an empty value for an existing
		// device and silently lose the user's previous choice on save.
		if (device.registeredDeviceCategory !== null) {
			categorySet.add(device.registeredDeviceCategory);
		}

		// When a descriptor exposes no categories at all, fall back to the full enum so the user
		// can still pick something for a generic device.
		const candidates: DevicesModuleDeviceCategory[] =
			categorySet.size > 0 ? Array.from(categorySet) : (Object.values(DevicesModuleDeviceCategory) as DevicesModuleDeviceCategory[]);

		return orderBy(candidates, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}));
	};

	tryOnMounted(() => {
		startSession().catch(() => {
			// The error is already surfaced via flashMessage / formResult.
		});
	});

	tryOnUnmounted(() => {
		stopPolling();

		if (session.value !== null) {
			endSession().catch(() => {
				// Best-effort cleanup — backend will time the session out anyway.
			});
		}
	});

	return {
		session: computed(() => session.value),
		devices,
		selectedDevices,
		permitJoin,
		bridgeOnline,
		formResult: computed(() => formResult.value),
		selected,
		categoryByIeee,
		nameByIeee,
		adoptionResults: computed(() => adoptionResults.value),
		canContinue,
		startSession,
		refreshSession,
		endSession,
		enablePermitJoin,
		disablePermitJoin,
		adoptSelected,
		categoryOptions,
	};
};
