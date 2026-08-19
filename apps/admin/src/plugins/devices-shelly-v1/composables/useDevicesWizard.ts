import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

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
	type DevicesShellyV1PluginCreateAdoptOperation,
	type DevicesShellyV1PluginCreateDiscoveryManualOperation,
	type DevicesShellyV1PluginCreateDiscoveryOperation,
	type DevicesShellyV1PluginGetDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_SHELLY_V1_PLUGIN_NAME, DEVICES_SHELLY_V1_PLUGIN_PREFIX } from '../devices-shelly-v1.constants';
import { DevicesShellyV1ApiException, DevicesShellyV1ValidationException } from '../devices-shelly-v1.exceptions';
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
// the hostname so the field is never blank. `||` (not `??`) is deliberate: the schema permits
// `name: ''`, and an empty string must fall through to the next candidate the same way `null`
// does, or a device reporting a blank name renders a blank Name column and blocks Adopt.
const suggestedNameFor = (device: IShellyV1DiscoveryDevice): string =>
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

	const session = ref<IShellyV1DiscoverySession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IShellyV1WizardAdoptionResult[]>([]);
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
				if (pollError instanceof DevicesShellyV1ApiException && pollError.code === 404) {
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
			started = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/discovery`);
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
			? getErrorReason<DevicesShellyV1PluginCreateDiscoveryOperation>(error, t('devicesShellyV1Plugin.messages.wizard.discoveryNotStarted'))
			: t('devicesShellyV1Plugin.messages.wizard.discoveryNotStarted');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		resumeRetainedPolling();

		throw new DevicesShellyV1ApiException(errorReason, response.status);
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
		} = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/discovery/{id}`, {
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
			? getErrorReason<DevicesShellyV1PluginGetDiscoveryOperation>(error, t('devicesShellyV1Plugin.messages.wizard.discoveryNotLoaded'))
			: t('devicesShellyV1Plugin.messages.wizard.discoveryNotLoaded');

		throw new DevicesShellyV1ApiException(errorReason, response.status);
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
			const errorReason = t('devicesShellyV1Plugin.fields.devices.hostname.validation.required');

			flashMessage.error(errorReason);

			throw new DevicesShellyV1ValidationException(errorReason);
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
			// the adoption endpoint.
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

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		formResult.value = FormResult.WORKING;

		// Snapshot the descriptors BEFORE refreshing. The shell already captured the user's
		// intent (name / category) in `selection`, but the refresh below can drop a device from
		// the live list entirely, and we still need its identifier to adopt the device the user
		// chose.
		const snapshot = devices.value.slice();

		if (session.value !== null) {
			try {
				await refreshDiscovery();
			} catch {
				// Stale snapshot is fine — the identifiers we need are already in hand.
			}
		}

		const outcomes: IShellyV1WizardAdoptionResult[] = [];
		const payload: {
			identifier: string;
			hostname: string;
			name: string;
			category: DevicesModuleDeviceCategory;
			password?: string | null;
		}[] = [];

		for (const item of selection) {
			const device =
				devices.value.find((candidate) => candidate.hostname === item.key) ?? snapshot.find((candidate) => candidate.hostname === item.key);

			if (device === undefined || device.identifier === null) {
				outcomes.push({
					hostname: item.key,
					name: item.name,
					status: 'failed',
					error: t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated'),
				});

				continue;
			}

			payload.push({
				identifier: device.identifier,
				hostname: device.hostname,
				// The shell already trims and defaults the name, but a blank one must never reach
				// the backend — fall back to the same chain that seeded the field.
				name: item.name.trim() || suggestedNameFor(device),
				category: item.category,
				password: passwordByHostname[device.hostname] ?? null,
			});
		}

		if (payload.length > 0) {
			// One request for the whole selection. Sending one per device tripped the backend's
			// shared rate limit past thirty devices, and left this composable racing the
			// connector's own auto-adoption — which the backend now settles against current
			// state instead of a snapshot taken here.
			try {
				const { data: responseBody, error, response } = await backend.client.POST(
					`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_V1_PLUGIN_PREFIX}/devices/adopt`,
					{ body: { data: { devices: payload } } }
				);

				if (typeof responseBody === 'undefined' || !response.ok) {
					const errorReason = error
						? getErrorReason<DevicesShellyV1PluginCreateAdoptOperation>(
								error,
								t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated')
							)
						: t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated');

					throw new DevicesShellyV1ApiException(errorReason, response.status);
				}

				for (const result of responseBody.data) {
					const requested = payload.find((item) => item.hostname === result.hostname);

					outcomes.push({
						hostname: result.hostname,
						name: requested?.name ?? result.hostname,
						status: result.status,
						error: result.reason,
					});
				}

				await devicesStore.fetch();
			} catch (error: unknown) {
				const reason =
					error instanceof Error ? error.message : t('devicesShellyV1Plugin.messages.wizard.adoptionNotCreated');

				for (const item of payload) {
					outcomes.push({ hostname: item.hostname, name: item.name, status: 'failed', error: reason });
				}
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
			sessionGeneration += 1;
		},
	};
};
