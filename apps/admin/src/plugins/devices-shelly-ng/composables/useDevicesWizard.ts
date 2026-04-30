import { type ComputedRef, type Reactive, computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';
import { v4 as uuid } from 'uuid';

import { tryOnMounted, tryOnUnmounted, useNow } from '@vueuse/core';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import { FormResult, type FormResultType, devicesStoreKey } from '../../../modules/devices';
import {
	DevicesModuleDeviceCategory,
	type DevicesShellyNgPluginCreateDiscoveryManualOperation,
	type DevicesShellyNgPluginCreateDiscoveryOperation,
	type DevicesShellyNgPluginGetDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_PREFIX, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgApiException } from '../devices-shelly-ng.exceptions';
import type { IShellyNgDiscoveryDevice, IShellyNgDiscoverySession } from '../schemas/devices.types';
import { transformDeviceInfoRequest, transformDiscoverySessionResponse } from '../utils/devices.transformers';

export interface IShellyNgWizardAdoptionResult {
	hostname: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

export const isAdoptableStatus = (status: IShellyNgDiscoveryDevice['status']): boolean => status === 'ready' || status === 'already_registered';

export interface IUseDevicesWizard {
	session: ComputedRef<IShellyNgDiscoverySession | null>;
	devices: ComputedRef<IShellyNgDiscoveryDevice[]>;
	selectedDevices: ComputedRef<IShellyNgDiscoveryDevice[]>;
	scanPercentage: ComputedRef<number>;
	formResult: ComputedRef<FormResultType>;
	manual: Reactive<{
		hostname: string;
		password: string;
	}>;
	selected: Reactive<Record<string, boolean>>;
	categoryByHostname: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	nameByHostname: Reactive<Record<string, string>>;
	adoptionResults: ComputedRef<IShellyNgWizardAdoptionResult[]>;
	canContinue: ComputedRef<boolean>;
	startDiscovery: () => Promise<void>;
	refreshDiscovery: () => Promise<void>;
	addManualDevice: () => Promise<void>;
	adoptSelected: () => Promise<IShellyNgWizardAdoptionResult[]>;
	categoryOptions: (device: IShellyNgDiscoveryDevice) => { value: DevicesModuleDeviceCategory; label: string }[];
}

export const useDevicesWizard = (): IUseDevicesWizard => {
	const { t } = useI18n();
	const backend = useBackend();
	const storesManager = injectStoresManager();
	const flashMessage = useFlashMessage();
	const devicesStore = storesManager.getStore(devicesStoreKey);

	const session = ref<IShellyNgDiscoverySession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IShellyNgWizardAdoptionResult[]>([]);
	const selected = reactive<Record<string, boolean>>({});
	const categoryByHostname = reactive<Record<string, DevicesModuleDeviceCategory | null>>({});
	const nameByHostname = reactive<Record<string, string>>({});
	const passwordByHostname = reactive<Record<string, string | null>>({});
	const manual = reactive({
		hostname: '',
		password: '',
	});
	const readyHostnames = new Set<string>();

	let pollingTimer: number | null = null;

	// Captured at every applySession so scanPercentage can tick forward independent of any
	// drift between the client and server clocks. We resnap to the server's `remainingSeconds`
	// on every poll, so any local drift is bounded by the polling interval (~1s).
	const sessionReceivedAt = ref<number | null>(null);
	const sessionRemainingMsAtReceipt = ref<number>(0);
	const sessionDurationMs = ref<number>(0);

	const now = useNow({ interval: 1_000 });

	const devices = computed<IShellyNgDiscoveryDevice[]>(() =>
		orderBy(session.value?.devices ?? [], [(device) => (isAdoptableStatus(device.status) ? 0 : 1), (device) => device.hostname], ['asc', 'asc'])
	);

	const scanPercentage = computed<number>(() => {
		if (session.value === null) {
			return 0;
		}

		if (session.value.status !== 'running') {
			return 100;
		}

		if (sessionReceivedAt.value === null || sessionDurationMs.value === 0) {
			return 0;
		}

		const elapsedSinceReceipt = Math.max(0, now.value.getTime() - sessionReceivedAt.value);
		const remainingMs = Math.max(0, sessionRemainingMsAtReceipt.value - elapsedSinceReceipt);
		const elapsed = sessionDurationMs.value - remainingMs;

		return Math.min(100, Math.max(0, Math.round((elapsed / sessionDurationMs.value) * 100)));
	});

	const selectedDevices = computed<IShellyNgDiscoveryDevice[]>(() =>
		devices.value.filter(
			(device) => selected[device.hostname] === true && isAdoptableStatus(device.status) && categoryByHostname[device.hostname] !== null
		)
	);

	const canContinue = computed<boolean>(() => selectedDevices.value.length > 0);

	const startPolling = (): void => {
		stopPolling();

		pollingTimer = window.setInterval(() => {
			refreshDiscovery().catch(() => {
				// User can trigger discovery again if polling fails.
			});
		}, 1_000);
	};

	const stopPolling = (): void => {
		if (pollingTimer !== null) {
			window.clearInterval(pollingTimer);
			pollingTimer = null;
		}
	};

	const applySession = (nextSession: IShellyNgDiscoverySession): void => {
		const previousDevices = session.value?.devices ?? [];

		session.value = nextSession;

		// Snap the client-side progress reference to the moment we received this snapshot.
		// scanPercentage ticks forward from here using `useNow`, so it stays accurate even
		// when the client clock is skewed relative to the server's startedAt/expiresAt.
		sessionReceivedAt.value = Date.now();
		sessionRemainingMsAtReceipt.value = nextSession.remainingSeconds * 1_000;
		sessionDurationMs.value = Math.max(1, new Date(nextSession.expiresAt).getTime() - new Date(nextSession.startedAt).getTime());

		for (const device of nextSession.devices) {
			const previousDevice = previousDevices.find((item) => item.hostname === device.hostname);
			const becameReady = previousDevice?.status === 'checking' && device.status === 'ready';
			const becameAdoptable = previousDevice?.status === 'checking' && isAdoptableStatus(device.status);
			const becameAlreadyRegistered =
				previousDevice !== undefined && previousDevice.status !== 'already_registered' && device.status === 'already_registered';
			const wasPreviouslyReady = readyHostnames.has(device.hostname);

			// `ready` devices are pre-selected so the user can adopt new devices in one step.
			// `already_registered` devices stay deselected — the user must opt in explicitly to override
			// the category/name the main service auto-adopted them with.
			//
			// If a device that was previously `ready` (and possibly user-selected) refreshes to
			// `already_registered` — typically because the main connector auto-adopted it during the
			// session — clear the selection so the next Adopt click doesn't silently update an
			// existing device. `adoptSelected` snapshots the user's selections before its own
			// refresh, so an in-flight adopt isn't dropped by this rule.
			if (selected[device.hostname] === undefined || (becameReady && !wasPreviouslyReady)) {
				selected[device.hostname] = device.status === 'ready';
			} else if (becameAlreadyRegistered) {
				selected[device.hostname] = false;
			}

			if (categoryByHostname[device.hostname] === undefined || (categoryByHostname[device.hostname] === null && device.suggestedCategory !== null)) {
				categoryByHostname[device.hostname] = device.suggestedCategory;
			}

			// Refresh the editable name when the inspect step finishes (checking → ready or
			// checking → already_registered) and the user hasn't typed anything yet — otherwise
			// `already_registered` devices would keep the hostname placeholder and overwrite the
			// existing registered name on update.
			if (nameByHostname[device.hostname] === undefined || (becameAdoptable && nameByHostname[device.hostname] === device.hostname)) {
				nameByHostname[device.hostname] = device.registeredDeviceName ?? device.name ?? device.displayName ?? device.hostname;
			}

			if (isAdoptableStatus(device.status)) {
				readyHostnames.add(device.hostname);
			}
		}

		if (nextSession.status !== 'running') {
			stopPolling();
		}
	};

	const resetSessionScopedState = (): void => {
		for (const key of Object.keys(selected)) {
			delete selected[key];
		}
		for (const key of Object.keys(categoryByHostname)) {
			delete categoryByHostname[key];
		}
		for (const key of Object.keys(nameByHostname)) {
			delete nameByHostname[key];
		}
		for (const key of Object.keys(passwordByHostname)) {
			delete passwordByHostname[key];
		}
		readyHostnames.clear();
	};

	const startDiscovery = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery`);

		if (typeof responseData !== 'undefined') {
			// Drop any selections / inputs from a previous scan before applying the new snapshot.
			// Otherwise a device that was `ready` last time and now shows as `already_registered`
			// would carry over `selected=true` and silently update an existing device on adopt.
			// Refreshes within the same session keep their state — only `startDiscovery` resets,
			// so the per-device race fallback in `adoptSelected` still works.
			resetSessionScopedState();
			applySession(transformDiscoverySessionResponse(responseData.data));
			formResult.value = FormResult.NONE;
			startPolling();

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesShellyNgPluginCreateDiscoveryOperation>(error, t('devicesShellyNgPlugin.messages.wizard.discoveryNotStarted'))
			: t('devicesShellyNgPlugin.messages.wizard.discoveryNotStarted');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesShellyNgApiException(errorReason, response.status);
	};

	const refreshDiscovery = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery/{id}`, {
			params: {
				path: {
					id: session.value.id,
				},
			},
		});

		if (typeof responseData !== 'undefined') {
			applySession(transformDiscoverySessionResponse(responseData.data));

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesShellyNgPluginGetDiscoveryOperation>(error, t('devicesShellyNgPlugin.messages.wizard.discoveryNotLoaded'))
			: t('devicesShellyNgPlugin.messages.wizard.discoveryNotLoaded');

		throw new DevicesShellyNgApiException(errorReason, response.status);
	};

	const addManualDevice = async (): Promise<void> => {
		if (session.value === null) {
			await startDiscovery();
		}

		if (session.value === null || manual.hostname.trim().length === 0) {
			return;
		}

		formResult.value = FormResult.WORKING;

		const hostname = manual.hostname.trim();
		const password = manual.password.trim() || null;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery/{id}/manual`, {
			params: {
				path: {
					id: session.value.id,
				},
			},
			body: {
				data: transformDeviceInfoRequest({
					hostname,
					password,
				}),
			},
		});

		if (typeof responseData !== 'undefined') {
			passwordByHostname[hostname] = password;
			manual.hostname = '';
			manual.password = '';
			applySession(transformDiscoverySessionResponse(responseData.data));
			formResult.value = FormResult.NONE;

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesShellyNgPluginCreateDiscoveryManualOperation>(error, t('devicesShellyNgPlugin.messages.wizard.manualNotAdded'))
			: t('devicesShellyNgPlugin.messages.wizard.manualNotAdded');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesShellyNgApiException(errorReason, response.status);
	};

	const adoptSelected = async (): Promise<IShellyNgWizardAdoptionResult[]> => {
		formResult.value = FormResult.WORKING;

		// Snapshot the user's intent BEFORE refreshing. The refresh below can flip a
		// `ready` device to `already_registered` (because the main connector auto-adopted
		// it concurrently), and `applySession` deselects on that transition to keep the
		// opt-in-for-updates contract on subsequent clicks. We still want THIS click to
		// adopt the device the user chose — as an update, since that's what the new
		// status means.
		const userSelections = selectedDevices.value.slice();

		// Refresh once so we see any device the main service auto-adopted between scan and adoption.
		// Lets us route those through `edit` instead of getting a duplicate-identifier error from `add`.
		if (session.value !== null) {
			try {
				await refreshDiscovery();
			} catch {
				// Stale snapshot is fine — the per-device fallback below still handles late races.
			}
		}

		const results: IShellyNgWizardAdoptionResult[] = [];

		for (const selection of userSelections) {
			const device = devices.value.find((item) => item.hostname === selection.hostname) ?? selection;
			const name = nameByHostname[device.hostname] || device.name || device.displayName || device.hostname;
			const category = categoryByHostname[device.hostname] as DevicesModuleDeviceCategory;
			const password = passwordByHostname[device.hostname] ?? null;

			try {
				if (device.status === 'already_registered' && device.registeredDeviceId !== null) {
					await updateRegistered(device.registeredDeviceId, { name, category, password });

					results.push({
						hostname: device.hostname,
						name,
						status: 'updated',
						error: null,
					});

					continue;
				}

				const id = uuid().toString();

				try {
					await devicesStore.add({
						id,
						draft: false,
						data: {
							id,
							type: DEVICES_SHELLY_NG_TYPE,
							category,
							identifier: device.identifier,
							name,
							description: null,
							enabled: true,
							password,
							wifiAddress: device.hostname,
						},
					});

					results.push({
						hostname: device.hostname,
						name,
						status: 'created',
						error: null,
					});
				} catch (createError: unknown) {
					// The device may have been auto-created by the main shelly-ng service after the discovery
					// snapshot was taken. Re-poll, and if it now shows as already_registered, fall back to update.
					try {
						await refreshDiscovery();
					} catch {
						// ignore — handled below
					}

					const refreshed = devices.value.find((item) => item.hostname === device.hostname);

					if (refreshed?.status === 'already_registered' && refreshed.registeredDeviceId !== null) {
						await updateRegistered(refreshed.registeredDeviceId, { name, category, password });

						results.push({
							hostname: device.hostname,
							name,
							status: 'updated',
							error: null,
						});

						continue;
					}

					throw createError;
				}
			} catch (error: unknown) {
				results.push({
					hostname: device.hostname,
					name,
					status: 'failed',
					error: error instanceof Error ? error.message : t('devicesShellyNgPlugin.messages.wizard.adoptionNotCreated'),
				});
			}
		}

		adoptionResults.value = results;
		formResult.value = results.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;

		return results;
	};

	const updateRegistered = async (
		id: string,
		{ name, category, password }: { name: string; category: DevicesModuleDeviceCategory; password: string | null }
	): Promise<void> => {
		const data: { type: string; name: string; category: DevicesModuleDeviceCategory; password?: string } = {
			type: DEVICES_SHELLY_NG_TYPE,
			name,
			category,
		};

		if (password !== null) {
			data.password = password;
		}

		// `devicesStore.edit` requires the device to be present in the local store. When the
		// main connector auto-adopts a device after the wizard's snapshot was taken, the new
		// row may not be in the admin store yet — pull it in first so the edit can land.
		if (devicesStore.findById(id) === null) {
			await devicesStore.get({ id });
		}

		await devicesStore.edit({ id, data });
	};

	const categoryOptions = (device: IShellyNgDiscoveryDevice): { value: DevicesModuleDeviceCategory; label: string }[] =>
		orderBy(device.categories, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}));

	tryOnMounted(() => {
		startDiscovery().catch(() => {
			// The message is already surfaced to the user.
		});
	});

	tryOnUnmounted(() => {
		stopPolling();
	});

	return {
		session: computed(() => session.value),
		devices,
		selectedDevices,
		scanPercentage,
		formResult: computed(() => formResult.value),
		manual,
		selected,
		categoryByHostname,
		nameByHostname,
		adoptionResults: computed(() => adoptionResults.value),
		canContinue,
		startDiscovery,
		refreshDiscovery,
		addManualDevice,
		adoptSelected,
		categoryOptions,
	};
};
