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
	type DevicesShellyV1PluginCreateDiscoveryManualOperation,
	type DevicesShellyV1PluginCreateDiscoveryOperation,
	type DevicesShellyV1PluginGetDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_PLUGIN_PREFIX, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { DevicesShellyV1ApiException } from '../devices-shelly-v1.exceptions';
import type { IShellyV1DiscoveryDevice, IShellyV1DiscoverySession } from '../schemas/devices.types';
import { transformDeviceInfoRequest, transformDiscoverySessionResponse } from '../utils/devices.transformers';

export interface IShellyV1WizardAdoptionResult {
	hostname: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

export const isAdoptableStatus = (status: IShellyV1DiscoveryDevice['status']): boolean =>
	status === 'ready' || status === 'already_registered';

export interface IUseDevicesWizard {
	session: ComputedRef<IShellyV1DiscoverySession | null>;
	devices: ComputedRef<IShellyV1DiscoveryDevice[]>;
	selectedDevices: ComputedRef<IShellyV1DiscoveryDevice[]>;
	scanPercentage: ComputedRef<number>;
	formResult: ComputedRef<FormResultType>;
	manual: Reactive<{
		hostname: string;
		password: string;
	}>;
	selected: Reactive<Record<string, boolean>>;
	categoryByHostname: Reactive<Record<string, DevicesModuleDeviceCategory | null>>;
	nameByHostname: Reactive<Record<string, string>>;
	adoptionResults: ComputedRef<IShellyV1WizardAdoptionResult[]>;
	canContinue: ComputedRef<boolean>;
	startDiscovery: () => Promise<void>;
	refreshDiscovery: () => Promise<void>;
	addManualDevice: () => Promise<void>;
	adoptSelected: () => Promise<IShellyV1WizardAdoptionResult[]>;
	categoryOptions: (device: IShellyV1DiscoveryDevice) => { value: DevicesModuleDeviceCategory; label: string }[];
}

export const useDevicesWizard = (): IUseDevicesWizard => {
	const { t } = useI18n();
	const backend = useBackend();
	const storesManager = injectStoresManager();
	const flashMessage = useFlashMessage();
	const devicesStore = storesManager.getStore(devicesStoreKey);

	const session = ref<IShellyV1DiscoverySession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IShellyV1WizardAdoptionResult[]>([]);
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

	const devices = computed<IShellyV1DiscoveryDevice[]>(() =>
		orderBy(
			session.value?.devices ?? [],
			[(device) => (isAdoptableStatus(device.status) ? 0 : 1), (device) => device.hostname],
			['asc', 'asc']
		)
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

	const selectedDevices = computed<IShellyV1DiscoveryDevice[]>(() =>
		devices.value.filter((device) => {
			const category = categoryByHostname[device.hostname];

			// Reject `undefined` (no entry yet) AND `null` (entry exists but no category chosen).
			// `categoryByHostname[hostname]` is typed as `DevicesModuleDeviceCategory | null`, but
			// indexing a `Record` for a missing key returns `undefined` at runtime — without the
			// `!= null` guard the filter would let half-initialized rows through and `adoptSelected`
			// would cast `undefined` to `DevicesModuleDeviceCategory` and send it to the backend.
			return selected[device.hostname] === true && isAdoptableStatus(device.status) && category != null;
		})
	);

	const canContinue = computed<boolean>(() => selectedDevices.value.length > 0);

	const startPolling = (): void => {
		stopPolling();

		pollingTimer = window.setInterval(() => {
			refreshDiscovery().catch(() => {
				// Stop polling on any error — the most likely failure is a 404 after the server
				// cleaned up the session, and there's no point re-hitting a missing endpoint every
				// second until the component unmounts. The user can hit "Scan again" to start a
				// fresh session.
				stopPolling();
			});
		}, 1_000);
	};

	const stopPolling = (): void => {
		if (pollingTimer !== null) {
			window.clearInterval(pollingTimer);
			pollingTimer = null;
		}
	};

	const applySession = (nextSession: IShellyV1DiscoverySession): void => {
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

			// Pre-fill the category dropdown so the wizard never lands on an empty selector for
			// already-adopted devices: prefer the existing DB category over the descriptor's
			// suggestion.
			const initialCategory = device.registeredDeviceCategory ?? device.suggestedCategory;

			if (categoryByHostname[device.hostname] === undefined || (categoryByHostname[device.hostname] === null && initialCategory !== null)) {
				categoryByHostname[device.hostname] = initialCategory;
			}

			// Refresh the editable name when the inspect step finishes (checking → ready or
			// checking → already_registered) and the user hasn't typed anything yet — otherwise
			// `already_registered` devices would keep the hostname placeholder and overwrite the
			// existing registered name on update.
			if (nameByHostname[device.hostname] === undefined || (becameAdoptable && nameByHostname[device.hostname] === device.hostname)) {
				nameByHostname[device.hostname] = device.registeredDeviceName ?? device.name ?? device.displayName ?? device.hostname;
			}

			// `readyHostnames` records devices that have been observed in the `ready` state at
			// least once during the session. Its only consumer is the `becameReady &&
			// !wasPreviouslyReady` guard above, which prevents re-selecting a device the user
			// already deselected. We must NOT include `already_registered` here — otherwise a
			// device that started as `already_registered`, was deleted from the DB mid-session,
			// then transitioned `checking → ready` would be treated as previously-ready and skip
			// auto-selection.
			if (device.status === 'ready') {
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
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/discovery`);

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
			? getErrorReason<DevicesShellyV1PluginCreateDiscoveryOperation>(error, t('devicesShellyV1Plugin.messages.wizard.discoveryNotStarted'))
			: t('devicesShellyV1Plugin.messages.wizard.discoveryNotStarted');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesShellyV1ApiException(errorReason, response.status);
	};

	const refreshDiscovery = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/discovery/{id}`, {
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
			? getErrorReason<DevicesShellyV1PluginGetDiscoveryOperation>(error, t('devicesShellyV1Plugin.messages.wizard.discoveryNotLoaded'))
			: t('devicesShellyV1Plugin.messages.wizard.discoveryNotLoaded');

		throw new DevicesShellyV1ApiException(errorReason, response.status);
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
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/discovery/{id}/manual`, {
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
			const nextSession = transformDiscoverySessionResponse(responseData.data);
			const inspected = nextSession.devices.find((item) => item.hostname === hostname);

			// Only persist the entered password when the backend confirms it works (or no auth was
			// involved). For `already_registered` devices, the DB-hit status takes priority over
			// `needs_password`, so a wrong password against an existing device still produces
			// `status: 'already_registered'` with `authentication.valid: false`. Storing it
			// unconditionally would overwrite the correct on-disk password the next time the user
			// hits Adopt — `adoptSelected` reads `passwordByHostname[hostname]` and sends it
			// straight to `updateRegistered`.
			if (password !== null && inspected?.authentication.valid !== false) {
				passwordByHostname[hostname] = password;
			}

			manual.hostname = '';
			manual.password = '';
			applySession(nextSession);
			formResult.value = FormResult.NONE;

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesShellyV1PluginCreateDiscoveryManualOperation>(error, t('devicesShellyV1Plugin.messages.wizard.manualNotAdded'))
			: t('devicesShellyV1Plugin.messages.wizard.manualNotAdded');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesShellyV1ApiException(errorReason, response.status);
	};

	const adoptSelected = async (): Promise<IShellyV1WizardAdoptionResult[]> => {
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

		const results: IShellyV1WizardAdoptionResult[] = [];

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
							type: DEVICES_SHELLY_V1_TYPE,
							category,
							identifier: device.identifier,
							name,
							description: null,
							enabled: true,
							password,
							hostname: device.hostname,
						},
					});

					results.push({
						hostname: device.hostname,
						name,
						status: 'created',
						error: null,
					});
				} catch (createError: unknown) {
					// The device may have been auto-created by the main shelly-v1 service after the discovery
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
					error: error instanceof Error ? error.message : t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated'),
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
			type: DEVICES_SHELLY_V1_TYPE,
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

	const categoryOptions = (device: IShellyV1DiscoveryDevice): { value: DevicesModuleDeviceCategory; label: string }[] =>
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
