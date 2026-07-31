import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { useNow } from '@vueuse/core';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, useBackend, useFlashMessage, useLogger } from '../../../common';
import { RouteNames as ConfigRouteNames } from '../../../modules/config';
import {
	FormResult,
	type FormResultType,
	type IDeviceWizardAdapter,
	type IWizardAdoptSelection,
	type IWizardControl,
	type IWizardResult,
	type IWizardRow,
} from '../../../modules/devices';
import {
	DevicesModuleDeviceCategory,
	type DevicesZigbee2mqttPluginAdoptWizardOperation,
	type DevicesZigbee2mqttPluginCreateWizardOperation,
	type DevicesZigbee2mqttPluginDeleteWizardOperation,
	type DevicesZigbee2mqttPluginDisableWizardPermitJoinOperation,
	type DevicesZigbee2mqttPluginEnableWizardPermitJoinOperation,
	type DevicesZigbee2mqttPluginGetWizardOperation,
} from '../../../openapi.constants';
import { DEVICES_ZIGBEE2MQTT_PLUGIN_NAME, DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX } from '../devices-zigbee2mqtt.constants';
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

export const isAdoptableStatus = (status: IZ2mWizardDevice['status']): boolean => status === 'ready' || status === 'already_registered';

const DEFAULT_PERMIT_JOIN: IZ2mWizardSession['permitJoin'] = {
	active: false,
	expiresAt: null,
	remainingSeconds: 0,
};

// Typical Zigbee permit-join window in seconds — used only to scale the progress bar.
const PERMIT_JOIN_WINDOW_SECONDS = 254;

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const backend = useBackend();
	const logger = useLogger();
	const flashMessage = useFlashMessage();
	const { humanize } = useFriendlyNameHumanizer();

	const session = ref<IZ2mWizardSession | null>(null);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const adoptionResults = ref<IZ2mWizardAdoptionResult[]>([]);
	const permitJoinPending = ref<boolean>(false);

	let pollingTimer: number | null = null;

	// Generation counter — incremented on every session boundary (start / end). Polling
	// captures the generation at schedule time; if the generation changed by the time the
	// awaited refresh resolves, the response is dropped instead of resurrecting the session.
	// This prevents an in-flight `refreshSession` started before `endSession` from writing
	// back to `session.value` after deletion and looping on 404s.
	let sessionGeneration = 0;

	// Tick the countdown locally between backend polls so the progress bar and "Xs remaining"
	// text update smoothly instead of freezing for a full second between server responses.
	// Resolution of 250 ms gives a perceptibly fluid bar without overdrawing.
	const now = useNow({ interval: 250 });

	const devices = computed<IZ2mWizardDevice[]>(() =>
		orderBy(session.value?.devices ?? [], [(device) => (isAdoptableStatus(device.status) ? 0 : 1), (device) => device.ieeeAddress], ['asc', 'asc'])
	);

	const permitJoin = computed<IZ2mWizardSession['permitJoin']>(() => session.value?.permitJoin ?? DEFAULT_PERMIT_JOIN);

	const bridgeOnline = computed<boolean>(() => session.value?.bridgeOnline ?? false);

	// `bridgeOnline` defaults to false while the session is still loading, which would otherwise
	// flash a misleading "Bridge offline / Configure the connection" alert on initial mount even
	// for healthy bridges. `sessionReady` lets consumers gate that alert until we have a real
	// answer from the backend.
	const sessionReady = computed<boolean>(() => session.value !== null);

	const categoryOptions = (): { value: DevicesModuleDeviceCategory; label: string }[] => {
		// The wizard always lets users pick any DeviceCategory — `suggestedCategory` and
		// `registeredDeviceCategory` are pre-fill defaults, not constraints. Render the
		// full enum sorted by translated label for stable, predictable ordering.
		return orderBy(
			Object.values(DevicesModuleDeviceCategory) as DevicesModuleDeviceCategory[],
			[(category: string) => t(`devicesModule.categories.devices.${category}`)],
			['asc']
		).map((value) => ({
			value,
			label: t(`devicesModule.categories.devices.${value}`),
		}));
	};

	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => ({
			key: device.ieeeAddress,
			label: device.registeredDeviceName ?? humanize(device.friendlyName),
			subLabel: [device.manufacturer, device.model].filter(Boolean).join(' · ') || null,
			identifier: device.friendlyName,
			status: device.status,
			adoptable: isAdoptableStatus(device.status),
			willUpdate: device.status === 'already_registered',
			suggestedName: device.registeredDeviceName ?? humanize(device.friendlyName),
			suggestedCategory: device.registeredDeviceCategory ?? device.suggestedCategory,
			categoryOptions: categoryOptions(),
			cells: {
				channels: {
					render: 'tag',
					value: t('devicesZigbee2mqttPlugin.wizard.columns.channelsCount', { count: device.previewChannelCount }),
					tooltip: device.previewChannelIdentifiers.join(', '),
				},
			},
		}))
	);

	const results = computed<IWizardResult[]>(() =>
		adoptionResults.value.map((result) => ({
			key: result.ieeeAddress,
			name: result.name,
			identifier: session.value?.devices.find((device) => device.ieeeAddress === result.ieeeAddress)?.friendlyName ?? result.ieeeAddress,
			status: result.status,
			error: result.error,
		}))
	);

	// Smoothed remaining seconds derived from the server-supplied `expiresAt`. Falls back to
	// the server's `remainingSeconds` if `expiresAt` isn't available yet (e.g. a transient null
	// during the first poll), so the UI still shows something sensible. `now` is deliberately
	// read last so the computed stays inert — and stops re-evaluating every 250 ms — whenever
	// pairing is not running.
	const smoothRemainingSeconds = computed<number>(() => {
		if (!permitJoin.value.active) {
			return 0;
		}

		if (permitJoin.value.expiresAt === null) {
			return permitJoin.value.remainingSeconds;
		}

		const expiresAtMs = new Date(permitJoin.value.expiresAt).getTime();

		if (Number.isNaN(expiresAtMs)) {
			return permitJoin.value.remainingSeconds;
		}

		return Math.max(0, Math.ceil((expiresAtMs - now.value.getTime()) / 1_000));
	});

	const permitJoinPercentage = computed<number>(() => {
		if (!permitJoin.value.active) {
			return 0;
		}

		// `el-progress` shows "how much is complete", so we render elapsed time (filling up
		// toward the deadline) rather than remaining time. Clamp to [0, 100] in case
		// `remainingSeconds` briefly exceeds the nominal window. Drives off the smoothed
		// countdown so the bar advances visibly between polls.
		const elapsedSeconds = Math.max(0, PERMIT_JOIN_WINDOW_SECONDS - smoothRemainingSeconds.value);

		return Math.min(100, Math.round((elapsedSeconds / PERMIT_JOIN_WINDOW_SECONDS) * 100));
	});

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
		// Row-level bookkeeping (selection, editable names, categories) belongs to the wizard
		// shell — the adapter only owns the raw session snapshot.
		session.value = nextSession;
	};

	const resetSessionScopedState = (): void => {
		adoptionResults.value = [];
	};

	const startSession = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;
		sessionGeneration += 1;
		const startGeneration = sessionGeneration;

		const { data: responseData, error, response } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard`);

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

		const fallback = t('devicesZigbee2mqttPlugin.messages.wizard.sessionNotStarted');
		const errorReason = error ? getErrorReason<DevicesZigbee2mqttPluginCreateWizardOperation>(error, fallback) : fallback;

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

		const fallback = t('devicesZigbee2mqttPlugin.messages.wizard.sessionNotLoaded');
		const errorReason = error ? getErrorReason<DevicesZigbee2mqttPluginGetWizardOperation>(error, fallback) : fallback;

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
			const { error } = await backend.client.DELETE(`/${PLUGINS_PREFIX}/${DEVICES_ZIGBEE2MQTT_PLUGIN_PREFIX}/wizard/{id}`, {
				params: {
					path: {
						id: currentSession.id,
					},
				},
			});

			if (error) {
				// Best-effort cleanup — DELETE failures are logged but don't surface to the user,
				// who has already moved on. The typed reason gives a clearer log line than the
				// raw API envelope.
				const reason = getErrorReason<DevicesZigbee2mqttPluginDeleteWizardOperation>(error, 'Failed to cleanly end z2m wizard session');
				logger.warn(reason);
			}
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
		const requestGeneration = sessionGeneration;

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

		// Drop the response if endSession (or restart) ran during the await — otherwise
		// applySession would resurrect the deleted session and trigger a 404 polling loop.
		if (sessionGeneration !== requestGeneration) {
			return;
		}

		if (typeof responseData !== 'undefined') {
			applySession(transformWizardSessionResponse((responseData as { data: ApiWizardSession }).data));
			formResult.value = FormResult.OK;

			return;
		}

		const fallback = t('devicesZigbee2mqttPlugin.messages.wizard.permitJoinNotEnabled');
		const errorReason = error ? getErrorReason<DevicesZigbee2mqttPluginEnableWizardPermitJoinOperation>(error, fallback) : fallback;

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	const disablePermitJoin = async (): Promise<void> => {
		if (session.value === null) {
			return;
		}

		formResult.value = FormResult.WORKING;
		const requestGeneration = sessionGeneration;

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

		// Drop the response if endSession (or restart) ran during the await — otherwise
		// applySession would resurrect the deleted session and trigger a 404 polling loop.
		if (sessionGeneration !== requestGeneration) {
			return;
		}

		if (typeof responseData !== 'undefined') {
			applySession(transformWizardSessionResponse((responseData as { data: ApiWizardSession }).data));
			formResult.value = FormResult.OK;

			return;
		}

		const fallback = t('devicesZigbee2mqttPlugin.messages.wizard.permitJoinNotDisabled');
		const errorReason = error ? getErrorReason<DevicesZigbee2mqttPluginDisableWizardPermitJoinOperation>(error, fallback) : fallback;

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	// Wraps the permit-join round-trip so the action control can render a loading state. Errors
	// are already surfaced by the transport calls via flashMessage; the flag is released either
	// way, and the rejection is swallowed because the shell invokes control handlers directly.
	const togglePermitJoin = async (): Promise<void> => {
		permitJoinPending.value = true;

		try {
			if (permitJoin.value.active) {
				await disablePermitJoin();
			} else {
				await enablePermitJoin();
			}
		} catch {
			// Error already surfaced by the transport call.
		} finally {
			permitJoinPending.value = false;
		}
	};

	const controls = computed<IWizardControl[]>(() => {
		// Until the first session snapshot lands, `bridgeOnline` is false for a healthy bridge
		// too — offering nothing beats flashing a misleading "Bridge offline" banner.
		if (!sessionReady.value) {
			return [];
		}

		if (!bridgeOnline.value) {
			return [
				{
					type: 'banner',
					id: 'bridge-offline',
					severity: 'warning',
					title: t('devicesZigbee2mqttPlugin.wizard.bridge.offline.title'),
					message: t('devicesZigbee2mqttPlugin.wizard.bridge.offline.message'),
					link: {
						label: t('devicesZigbee2mqttPlugin.wizard.bridge.offline.openConfig'),
						to: { name: ConfigRouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME } },
					},
				},
			];
		}

		return [
			{
				type: 'progress',
				id: 'pairing',
				label: t('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingActive', { remaining: smoothRemainingSeconds.value }),
				percentage: permitJoinPercentage.value,
				state: permitJoinPercentage.value >= 75 ? 'warning' : undefined,
				visible: permitJoin.value.active,
			},
			permitJoin.value.active
				? {
						type: 'action',
						id: 'permit-join',
						label: t('devicesZigbee2mqttPlugin.wizard.steps.discovery.cancelPairing'),
						icon: 'mdi:close-circle-outline',
						variant: 'warning',
						loading: permitJoinPending.value,
						disabled: permitJoinPending.value,
						handler: togglePermitJoin,
					}
				: {
						type: 'action',
						id: 'permit-join',
						label: t('devicesZigbee2mqttPlugin.wizard.steps.discovery.permitJoin'),
						icon: 'mdi:plus-circle-outline',
						variant: 'primary',
						loading: permitJoinPending.value,
						disabled: permitJoinPending.value,
						handler: togglePermitJoin,
					},
		];
	});

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		if (session.value === null) {
			return [];
		}

		formResult.value = FormResult.WORKING;

		const adoptDevices = selection.map((item) => {
			const device = session.value?.devices.find((candidate) => candidate.ieeeAddress === item.key);

			return {
				ieeeAddress: item.key,
				// The shell already trims and defaults the name, but a blank one must never reach
				// the backend — fall back to the humanized friendly name, then the address.
				name: item.name.trim() || (device !== undefined ? humanize(device.friendlyName) : '') || item.key,
				category: item.category ?? DevicesModuleDeviceCategory.generic,
			};
		});

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
			adoptionResults.value = transformWizardAdoptionResponse((responseData as { data: ApiWizardAdoption }).data);
			formResult.value = adoptionResults.value.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;

			return results.value;
		}

		const fallback = t('devicesZigbee2mqttPlugin.messages.wizard.adoptionFailed');
		const errorReason = error ? getErrorReason<DevicesZigbee2mqttPluginAdoptWizardOperation>(error, fallback) : fallback;

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesZigbee2mqttApiException(errorReason, response.status);
	};

	return {
		title: t('devicesZigbee2mqttPlugin.wizard.title'),
		subtitle: t('devicesZigbee2mqttPlugin.wizard.subtitle'),
		breadcrumbLabel: t('devicesZigbee2mqttPlugin.wizard.breadcrumb'),
		pluginType: DEVICES_ZIGBEE2MQTT_PLUGIN_NAME,
		identifierLabel: t('devicesZigbee2mqttPlugin.wizard.columns.friendlyName'),
		rows,
		results,
		columns: [
			{
				key: 'channels',
				label: t('devicesZigbee2mqttPlugin.wizard.columns.channels'),
				steps: ['confirm'],
				width: 120,
				sortable: true,
			},
		],
		controls,
		ready: sessionReady,
		busy: computed<boolean>(() => formResult.value === FormResult.WORKING),
		capabilities: { addMore: true },
		start: startSession,
		adopt,
		beforeLeaveDiscover: async (): Promise<void> => {
			// Pairing must never stay open once the user moves on — silently turn it off so the
			// gateway stops accepting new joins while the confirm step is in focus.
			if (permitJoin.value.active) {
				await disablePermitJoin();

				flashMessage.info(t('devicesZigbee2mqttPlugin.wizard.steps.discovery.pairingDisabled'));
			}
		},
		// "Add more" wipes the previous session so the next round of pairings starts clean.
		// Teardown is best-effort — a failed DELETE must not block the fresh session.
		restart: async (): Promise<void> => {
			await endSession().catch(() => undefined);
			await startSession();
		},
		dispose: endSession,
	};
};
