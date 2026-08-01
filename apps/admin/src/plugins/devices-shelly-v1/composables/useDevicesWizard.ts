import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';
import { v4 as uuid } from 'uuid';

import { useNow } from '@vueuse/core';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import {
	FormResult,
	type FormResultType,
	type IDeviceWizardAdapter,
	type IWizardAdoptSelection,
	type IWizardControl,
	type IWizardResult,
	type IWizardRow,
	type IWizardRowStatus,
	devicesStoreKey,
} from '../../../modules/devices';
import {
	type DevicesModuleDeviceCategory,
	type DevicesShellyV1PluginCreateDiscoveryManualOperation,
	type DevicesShellyV1PluginCreateDiscoveryOperation,
	type DevicesShellyV1PluginGetDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_PLUGIN_PREFIX, DEVICES_SHELLY_V1_TYPE } from '../devices-shelly-v1.constants';
import { DevicesShellyV1ApiException } from '../devices-shelly-v1.exceptions';
import type { IShellyV1DiscoveryDevice, IShellyV1DiscoverySession } from '../schemas/devices.types';
import { transformDeviceInfoRequest, transformDiscoverySessionResponse } from '../utils/devices.transformers';

export interface IShellyV1WizardAdoptionResult {
	hostname: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

export const isAdoptableStatus = (status: IShellyV1DiscoveryDevice['status']): boolean => status === 'ready' || status === 'already_registered';

// The shared contract renames `needs_password` to the provider-neutral `needs_credentials`;
// every other Shelly status maps through unchanged.
const toWizardStatus = (status: IShellyV1DiscoveryDevice['status']): IWizardRowStatus => (status === 'needs_password' ? 'needs_credentials' : status);

// Single source of truth for the name we show and the name we send: an already registered
// device keeps its stored name, everything else falls back through the descriptor down to
// the hostname so the field is never blank.
const suggestedNameFor = (device: IShellyV1DiscoveryDevice): string =>
	device.registeredDeviceName ?? device.name ?? device.displayName ?? device.hostname;

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const backend = useBackend();
	const storesManager = injectStoresManager();
	const flashMessage = useFlashMessage();
	const devicesStore = storesManager.getStore(devicesStoreKey);

	const session = ref<IShellyV1DiscoverySession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IShellyV1WizardAdoptionResult[]>([]);
	// Passwords typed into the manual-add form never come back from the discovery endpoint,
	// so we remember them here to hand over on adoption.
	const passwordByHostname = reactive<Record<string, string | null>>({});

	let pollingTimer: number | null = null;

	// Captured at every applySession so scanPercentage can tick forward independent of any
	// drift between the client and server clocks. We resnap to the server's `remainingSeconds`
	// on every poll, so any local drift is bounded by the polling interval (~1s).
	const sessionReceivedAt = ref<number | null>(null);
	const sessionRemainingMsAtReceipt = ref<number>(0);
	const sessionDurationMs = ref<number>(0);

	const now = useNow({ interval: 1_000 });

	const devices = computed<IShellyV1DiscoveryDevice[]>(() =>
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

	// Unlike Zigbee2MQTT, Shelly narrows the choice per model: a Plus 1 supports both
	// `lighting` and `switcher`, a dimmer only `lighting`. Offering the full enum would let
	// the user pick a category the descriptor cannot back.
	const categoryOptions = (device: IShellyV1DiscoveryDevice): { value: DevicesModuleDeviceCategory; label: string }[] =>
		orderBy(device.categories, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}));

	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => ({
			key: device.hostname,
			label: device.registeredDeviceName ?? device.name ?? device.displayName ?? device.model ?? device.hostname,
			subLabel: device.displayName ?? device.model,
			identifier: device.hostname,
			status: toWizardStatus(device.status),
			adoptable: isAdoptableStatus(device.status),
			willUpdate: device.status === 'already_registered',
			suggestedName: suggestedNameFor(device),
			// Prefer the existing DB category over the descriptor's suggestion — the descriptor
			// only suggests when the model maps to exactly one category, so a Plus 1 would
			// otherwise show as blank even though we already picked one when adopting it.
			suggestedCategory: device.registeredDeviceCategory ?? device.suggestedCategory,
			categoryOptions: categoryOptions(device),
		}))
	);

	const results = computed<IWizardResult[]>(() =>
		adoptionResults.value.map((result) => ({
			key: result.hostname,
			name: result.name,
			identifier: result.hostname,
			status: result.status,
			error: result.error,
		}))
	);

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

	const applySession = (nextSession: IShellyV1DiscoverySession): void => {
		// Row-level bookkeeping (selection, editable names, categories) belongs to the wizard
		// shell — the adapter only owns the raw session snapshot and the scan progress anchor.
		session.value = nextSession;

		// Snap the client-side progress reference to the moment we received this snapshot.
		// scanPercentage ticks forward from here using `useNow`, so it stays accurate even
		// when the client clock is skewed relative to the server's startedAt/expiresAt.
		sessionReceivedAt.value = Date.now();
		sessionRemainingMsAtReceipt.value = nextSession.remainingSeconds * 1_000;
		sessionDurationMs.value = Math.max(1, new Date(nextSession.expiresAt).getTime() - new Date(nextSession.startedAt).getTime());

		if (nextSession.status !== 'running') {
			stopPolling();
		}
	};

	const resetSessionScopedState = (): void => {
		for (const key of Object.keys(passwordByHostname)) {
			delete passwordByHostname[key];
		}

		adoptionResults.value = [];
	};

	const startDiscovery = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/discovery`);

		if (typeof responseData !== 'undefined') {
			// Drop any manual-add password from a previous scan before applying the new snapshot.
			// Refreshes within the same session keep their state — only `startDiscovery` resets,
			// so the per-device race fallback in `adopt` still works.
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

	// Rejecting is meaningful here: the shell keeps whatever the user typed in the form so the
	// hostname or password can be corrected and resubmitted.
	const addManualDevice = async (values: Record<string, string>): Promise<void> => {
		const hostname = (values.hostname ?? '').trim();

		if (hostname.length === 0) {
			return;
		}

		const password = (values.password ?? '').trim() || null;

		if (session.value === null) {
			await startDiscovery();
		}

		if (session.value === null) {
			return;
		}

		formResult.value = FormResult.WORKING;

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
			// hits Adopt — `adopt` reads `passwordByHostname[hostname]` and sends it straight to
			// `updateRegistered`.
			if (password !== null && inspected?.authentication.valid !== false) {
				passwordByHostname[hostname] = password;
			}

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

	// The shell invokes action handlers without awaiting them, so letting `startDiscovery`
	// reject here would leak an unhandled promise rejection. The reason is already flashed
	// by the transport call.
	const restartDiscovery = async (): Promise<void> => {
		try {
			await startDiscovery();
		} catch {
			// Error already surfaced by the transport call.
		}
	};

	const controls = computed<IWizardControl[]>(() => [
		{
			type: 'banner',
			id: 'hint',
			severity: 'info',
			title: t('devicesShellyV1Plugin.texts.wizard.discovery'),
		},
		{
			type: 'progress',
			id: 'scan',
			label: t('devicesShellyV1Plugin.texts.wizard.scanStatus', { count: devices.value.length }),
			percentage: scanPercentage.value,
			state: session.value?.status === 'finished' ? 'success' : undefined,
			visible: true,
		},
		{
			type: 'action',
			id: 'restart-scan',
			label: t('devicesShellyV1Plugin.buttons.wizard.restart.title'),
			icon: 'mdi:radar',
			loading: formResult.value === FormResult.WORKING,
			handler: restartDiscovery,
		},
		{
			type: 'form',
			id: 'manual',
			fields: [
				{
					key: 'hostname',
					label: t('devicesShellyV1Plugin.fields.devices.hostname.title'),
					placeholder: t('devicesShellyV1Plugin.fields.devices.hostname.placeholder'),
				},
				{
					key: 'password',
					label: t('devicesShellyV1Plugin.fields.devices.password.title'),
					placeholder: t('devicesShellyV1Plugin.fields.devices.password.placeholder'),
					secret: true,
				},
			],
			submitLabel: t('devicesShellyV1Plugin.buttons.wizard.addManual.title'),
			submitIcon: 'mdi:plus',
			submitDisabled: formResult.value === FormResult.WORKING,
			loading: formResult.value === FormResult.WORKING,
			handler: addManualDevice,
		},
	]);

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

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		formResult.value = FormResult.WORKING;

		// Snapshot the descriptors BEFORE refreshing. The shell already captured the user's
		// intent (name / category) in `selection`, but the refresh below can drop a device from
		// the live list entirely, and we still need its identifier and registration state to
		// adopt the device the user chose.
		const snapshot = devices.value.slice();

		// Refresh once so we see any device the main service auto-adopted between scan and adoption.
		// Lets us route those through `edit` instead of getting a duplicate-identifier error from `add`.
		if (session.value !== null) {
			try {
				await refreshDiscovery();
			} catch {
				// Stale snapshot is fine — the per-device fallback below still handles late races.
			}
		}

		const outcomes: IShellyV1WizardAdoptionResult[] = [];

		for (const item of selection) {
			const device =
				devices.value.find((candidate) => candidate.hostname === item.key) ?? snapshot.find((candidate) => candidate.hostname === item.key);

			if (device === undefined) {
				outcomes.push({
					hostname: item.key,
					name: item.name,
					status: 'failed',
					error: t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated'),
				});

				continue;
			}

			// The shell already trims and defaults the name, but a blank one must never reach
			// the backend — fall back to the same chain that seeded the field.
			const name = item.name.trim() || suggestedNameFor(device);
			const category = item.category;
			const password = passwordByHostname[device.hostname] ?? null;

			try {
				if (device.status === 'already_registered' && device.registeredDeviceId !== null) {
					await updateRegistered(device.registeredDeviceId, { name, category, password });

					outcomes.push({
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

					outcomes.push({
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

					const refreshed = devices.value.find((candidate) => candidate.hostname === device.hostname);

					if (refreshed?.status === 'already_registered' && refreshed.registeredDeviceId !== null) {
						await updateRegistered(refreshed.registeredDeviceId, { name, category, password });

						outcomes.push({
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
				outcomes.push({
					hostname: device.hostname,
					name,
					status: 'failed',
					error: error instanceof Error ? error.message : t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated'),
				});
			}
		}

		adoptionResults.value = outcomes;
		formResult.value = outcomes.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;

		return results.value;
	};

	return {
		title: t('devicesShellyV1Plugin.headings.wizard.title'),
		subtitle: t('devicesShellyV1Plugin.subHeadings.wizard'),
		breadcrumbLabel: t('devicesShellyV1Plugin.breadcrumbs.wizard'),
		pluginType: DEVICES_SHELLY_V1_PLUGIN_NAME,
		identifierLabel: t('devicesShellyV1Plugin.fields.devices.hostname.title'),
		rows,
		results,
		columns: [],
		controls,
		// "Scan again" opens a new session from the discover step, a path the shell cannot see.
		// Handing over the session id lets it drop the previous scan's selections, which would
		// otherwise silently update a device the main connector adopted between the two scans.
		sessionKey: computed<string | null>(() => session.value?.id ?? null),
		// Always ready: none of the Shelly controls render misleading state before the first
		// snapshot lands, and a session-gated overlay would hide the manual-add form and the
		// rescan button — the only two escape hatches when the initial scan fails to start.
		ready: computed<boolean>(() => true),
		busy: computed<boolean>(() => formResult.value === FormResult.WORKING),
		// Shelly has no gateway-side pairing window to reopen, so a second round is just
		// another scan the user can trigger from the discover step.
		capabilities: { addMore: false },
		start: startDiscovery,
		adopt,
		// There is no server-side session to tear down, but the 1s poll must not outlive the
		// wizard view.
		dispose: async (): Promise<void> => {
			stopPolling();
		},
	};
};
