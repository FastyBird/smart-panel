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
	type DevicesShellyNgPluginCreateDiscoveryManualOperation,
	type DevicesShellyNgPluginCreateDiscoveryOperation,
	type DevicesShellyNgPluginGetDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_NG_PLUGIN_NAME, DEVICES_SHELLY_NG_PLUGIN_PREFIX, DEVICES_SHELLY_NG_TYPE } from '../devices-shelly-ng.constants';
import { DevicesShellyNgApiException, DevicesShellyNgValidationException } from '../devices-shelly-ng.exceptions';
import type { IShellyNgDiscoveryDevice, IShellyNgDiscoverySession } from '../schemas/devices.types';
import { transformDeviceInfoRequest, transformDiscoverySessionResponse } from '../utils/devices.transformers';

export interface IShellyNgWizardAdoptionResult {
	hostname: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

export const isAdoptableStatus = (status: IShellyNgDiscoveryDevice['status']): boolean => status === 'ready' || status === 'already_registered';

// The shared contract renames `needs_password` to the provider-neutral `needs_credentials`;
// every other Shelly status maps through unchanged.
const toWizardStatus = (status: IShellyNgDiscoveryDevice['status']): IWizardRowStatus => (status === 'needs_password' ? 'needs_credentials' : status);

// Single source of truth for the name we show and the name we send: an already registered
// device keeps its stored name, everything else falls back through the descriptor down to
// the hostname so the field is never blank. `||` (not `??`) is deliberate: the schema permits
// `name: ''`, and an empty string must fall through to the next candidate the same way `null`
// does, or a device reporting a blank name renders a blank Name column and blocks Adopt.
const suggestedNameFor = (device: IShellyNgDiscoveryDevice): string =>
	device.registeredDeviceName || device.name || device.displayName || device.hostname;

// Normal polling cadence, and the ceiling a failing backend is backed off to. Retries never
// stop on a recoverable error — only the gap between them widens.
const POLL_INTERVAL_MS = 1_000;
const MAX_POLL_BACKOFF_MS = 30_000;

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const backend = useBackend();
	const storesManager = injectStoresManager();
	const flashMessage = useFlashMessage();
	const devicesStore = storesManager.getStore(devicesStoreKey);

	const session = ref<IShellyNgDiscoverySession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IShellyNgWizardAdoptionResult[]>([]);
	// Passwords typed into the manual-add form never come back from the discovery endpoint,
	// so we remember them here to hand over on adoption.
	const passwordByHostname = reactive<Record<string, string | null>>({});

	let pollingTimer: number | null = null;

	// Generation counter — bumped on every session boundary (start / dispose). A request captures
	// the generation before its await and drops its response if the generation moved on. Without
	// it, a poll issued against session A that resolves after "Scan again" installed session B
	// would overwrite B; polling would then run against a session the backend already finished,
	// `applySession` would stop the timer, and the new scan would be orphaned with the UI still
	// showing the old one — "Scan again" appearing to do nothing.
	let sessionGeneration = 0;

	// Current gap between polls: reset to POLL_INTERVAL_MS by any successful snapshot, doubled by
	// each recoverable failure.
	let pollDelayMs = POLL_INTERVAL_MS;

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

	// Unlike Zigbee2MQTT, Shelly narrows the choice per model: a Plus 1 supports both
	// `lighting` and `switcher`, a dimmer only `lighting`. Offering the full enum would let
	// the user pick a category the descriptor cannot back.
	const categoryOptions = (device: IShellyNgDiscoveryDevice): { value: DevicesModuleDeviceCategory; label: string }[] =>
		orderBy(device.categories, [(category: string) => t(`devicesModule.categories.devices.${category}`)], ['asc']).map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}));

	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => ({
			key: device.hostname,
			label: device.registeredDeviceName || device.name || device.displayName || device.model || device.hostname,
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

	// A self-scheduling timeout rather than a fixed interval, so a failing backend can be backed
	// off without ever being abandoned. Expiry is not a failure: the backend keeps a finished
	// session fetchable for minutes (FINISHED_SESSION_TTL_MS), and that terminal snapshot is what
	// moves the UI out of the `running` state. Giving up at expiry during an outage would strand
	// the wizard on stale devices and a scan that never completes. Only a definitive 404 or a
	// terminal snapshot ends polling.
	const schedulePoll = (): void => {
		stopPolling();

		const scheduledGeneration = sessionGeneration;

		pollingTimer = window.setTimeout(async (): Promise<void> => {
			pollingTimer = null;

			try {
				await refreshDiscovery();

				pollDelayMs = POLL_INTERVAL_MS;
			} catch (pollError: unknown) {
				// The server dropped the session for good; there is nothing left to fetch.
				if (pollError instanceof DevicesShellyNgApiException && pollError.code === 404) {
					return;
				}

				// Anything else — a blip, a 5xx, a dropped connection — may recover. Widen the gap
				// so an unreachable backend is not hit every second, but keep trying.
				pollDelayMs = Math.min(pollDelayMs * 2, MAX_POLL_BACKOFF_MS);
			}

			// A newer session, or a dispose, took over while this poll was in flight.
			if (sessionGeneration !== scheduledGeneration) {
				return;
			}

			// A terminal snapshot means the scan is done and there is nothing left to discover.
			if (session.value === null || session.value.status !== 'running') {
				return;
			}

			schedulePoll();
		}, pollDelayMs);
	};

	const startPolling = (): void => {
		pollDelayMs = POLL_INTERVAL_MS;

		schedulePoll();
	};

	const stopPolling = (): void => {
		if (pollingTimer !== null) {
			window.clearTimeout(pollingTimer);
			pollingTimer = null;
		}
	};

	const applySession = (nextSession: IShellyNgDiscoverySession): void => {
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

	// A rescan that never happened leaves the previous session on screen — and still
	// discovering on the backend. Its interval was stopped before the POST; hand it back, or the
	// table silently freezes with no visible cause.
	const resumeRetainedPolling = (): void => {
		if (session.value !== null && session.value.status === 'running') {
			startPolling();
		}
	};

	const startDiscovery = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;

		// Kill the running interval before the POST so it cannot queue further polls against the
		// session we are about to replace, and bump the generation so a poll already in flight
		// drops its response instead of overwriting the new session.
		stopPolling();
		sessionGeneration += 1;
		const startGeneration = sessionGeneration;

		let started;

		try {
			started = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery`);
		} catch (transportError: unknown) {
			// `openapi-fetch` rethrows a transport failure rather than returning `{ error, response }`,
			// so this path never reaches the recovery below. Without it the wizard is left behind a
			// spinner that never resolves, with the retained session no longer polling.
			if (sessionGeneration === startGeneration) {
				formResult.value = FormResult.ERROR;
				resumeRetainedPolling();
			}

			throw transportError;
		}

		const { data: responseData, error, response } = started;

		// A newer start (or a dispose) landed while this POST was in flight — its session is the
		// one the user is looking at, so this response is stale.
		if (sessionGeneration !== startGeneration) {
			return;
		}

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
			? getErrorReason<DevicesShellyNgPluginCreateDiscoveryOperation>(error, t('devicesShellyNgPlugin.messages.wizard.discoveryNotStarted'))
			: t('devicesShellyNgPlugin.messages.wizard.discoveryNotStarted');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		resumeRetainedPolling();

		throw new DevicesShellyNgApiException(errorReason, response.status);
	};

	const refreshDiscovery = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		const pollGeneration = sessionGeneration;

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

		// The session was replaced or torn down while this poll was in flight; applying it would
		// resurrect the old snapshot over the current one.
		if (sessionGeneration !== pollGeneration) {
			return;
		}

		if (typeof responseData !== 'undefined') {
			applySession(transformDiscoverySessionResponse(responseData.data));

			return;
		}

		const errorReason = error
			? getErrorReason<DevicesShellyNgPluginGetDiscoveryOperation>(error, t('devicesShellyNgPlugin.messages.wizard.discoveryNotLoaded'))
			: t('devicesShellyNgPlugin.messages.wizard.discoveryNotLoaded');

		throw new DevicesShellyNgApiException(errorReason, response.status);
	};

	// Rejecting is meaningful here: the shell keeps whatever the user typed in the form so the
	// hostname or password can be corrected and resubmitted.
	const addManualDevice = async (values: Record<string, string>): Promise<void> => {
		const hostname = (values.hostname ?? '').trim();

		if (hostname.length === 0) {
			// The old component disabled the Add button on a blank hostname. `IWizardFormControl`'s
			// `submitDisabled` is a static boolean the adapter can't recompute per keystroke, so the
			// button stays enabled — this must REJECT, not resolve, or the shell's `onSubmitForm`
			// would clear the whole form, including a password the user already typed alongside it.
			const errorReason = t('devicesShellyNgPlugin.fields.devices.hostname.validation.required');

			flashMessage.error(errorReason);

			throw new DevicesShellyNgValidationException(errorReason);
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
			title: t('devicesShellyNgPlugin.texts.wizard.discovery'),
		},
		{
			type: 'progress',
			id: 'scan',
			label: t('devicesShellyNgPlugin.texts.wizard.scanStatus', { count: devices.value.length }),
			percentage: scanPercentage.value,
			state: session.value?.status === 'finished' ? 'success' : undefined,
			visible: true,
		},
		{
			type: 'action',
			id: 'restart-scan',
			label: t('devicesShellyNgPlugin.buttons.wizard.restart.title'),
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
					label: t('devicesShellyNgPlugin.fields.devices.hostname.title'),
					placeholder: t('devicesShellyNgPlugin.fields.devices.hostname.placeholder'),
				},
				{
					key: 'password',
					label: t('devicesShellyNgPlugin.fields.devices.password.title'),
					placeholder: t('devicesShellyNgPlugin.fields.devices.password.placeholder'),
					secret: true,
				},
			],
			submitLabel: t('devicesShellyNgPlugin.buttons.wizard.addManual.title'),
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

		const outcomes: IShellyNgWizardAdoptionResult[] = [];

		for (const item of selection) {
			const device =
				devices.value.find((candidate) => candidate.hostname === item.key) ?? snapshot.find((candidate) => candidate.hostname === item.key);

			if (device === undefined) {
				outcomes.push({
					hostname: item.key,
					name: item.name,
					status: 'failed',
					error: t('devicesShellyNgPlugin.messages.wizard.adoptionNotCreated'),
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

					outcomes.push({
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
					error: error instanceof Error ? error.message : t('devicesShellyNgPlugin.messages.wizard.adoptionNotCreated'),
				});
			}
		}

		adoptionResults.value = outcomes;
		formResult.value = outcomes.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;

		return results.value;
	};

	return {
		title: t('devicesShellyNgPlugin.headings.wizard.title'),
		subtitle: t('devicesShellyNgPlugin.subHeadings.wizard'),
		breadcrumbLabel: t('devicesShellyNgPlugin.breadcrumbs.wizard'),
		pluginType: DEVICES_SHELLY_NG_PLUGIN_NAME,
		identifierLabel: t('devicesShellyNgPlugin.fields.devices.hostname.title'),
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
			sessionGeneration += 1;
		},
	};
};
