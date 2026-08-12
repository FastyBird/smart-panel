import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useFlashMessage, useLogger } from '../../../common';
import {
	FormResult,
	type FormResultType,
	type IDeviceWizardAdapter,
	type IWizardAdoptSelection,
	type IWizardControl,
	type IWizardResult,
	type IWizardRow,
	devicesStoreKey,
} from '../../../modules/devices';
import {
	DevicesModuleDeviceCategory,
	DevicesWledPluginAdoptDeviceCategory,
	type DevicesWledPluginAdoptDiscoveryOperation,
	type DevicesWledPluginGetDiscoveryOperation,
	type DevicesWledPluginProbeDiscoveryOperation,
	type DevicesWledPluginRescanDiscoveryOperation,
} from '../../../openapi.constants';
import { DEVICES_WLED_PLUGIN_NAME, DEVICES_WLED_PLUGIN_PREFIX } from '../devices-wled.constants';
import { DevicesWledApiException, DevicesWledValidationException } from '../devices-wled.exceptions';

interface IWledWizardDevice {
	host: string;
	name: string;
	mac: string | null;
	port: number;
	adoptedDeviceId: string | null;
}

interface IWledWizardInventory {
	mdnsEnabled: boolean;
	discoveryRunning: boolean;
	devices: IWledWizardDevice[];
}

interface IWledWizardAdoptionResult {
	host: string;
	name: string;
	status: 'created' | 'updated' | 'failed';
	error: string | null;
}

const POLL_INTERVAL_MS = 2_000;

const deviceKey = (device: IWledWizardDevice): string =>
	device.mac ? `mac:${device.mac.replace(/[^a-fA-F0-9]/g, '').toLowerCase()}` : `host:${device.host}`;

const adoptionHost = (device: IWledWizardDevice): string => {
	const host = device.host.trim();
	const hasExplicitPort = /^\[[^\]]+\]:\d+$/.test(host) || /^[^:]+:\d+$/.test(host);
	if (hasExplicitPort) return host;

	const normalizedHost = host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
	if (device.port === 80) return normalizedHost;

	return `${normalizedHost}:${device.port}`;
};

const adoptionEndpointKey = (device: IWledWizardDevice): string => {
	const endpoint = adoptionHost(device);

	try {
		const url = new URL(`http://${endpoint}`);
		return `${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ''}`;
	} catch {
		return endpoint.toLowerCase().replace(/:80$/, '');
	}
};

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const backend = useBackend();
	const flashMessage = useFlashMessage();
	const logger = useLogger();
	const storesManager = injectStoresManager();
	const devicesStore = storesManager.getStore(devicesStoreKey);
	const inventory = ref<IWledWizardInventory | null>(null);
	const manualDevices = ref<IWledWizardDevice[]>([]);
	const adoptionResults = ref<IWledWizardAdoptionResult[]>([]);
	const formResult = ref<FormResultType>(FormResult.NONE);
	const discoveryError = ref<string | null>(null);
	const generation = ref(0);
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let rescanPromise: Promise<void> | null = null;
	let disposed = false;

	const devices = computed<IWledWizardDevice[]>(() => {
		const merged = new Map<string, IWledWizardDevice>();
		for (const device of inventory.value?.devices ?? []) {
			merged.set(deviceKey(device), device);
		}
		for (const device of manualDevices.value) {
			for (const [key, candidate] of merged) {
				if (adoptionEndpointKey(candidate) === adoptionEndpointKey(device)) merged.delete(key);
			}
			merged.set(deviceKey(device), device);
		}
		return orderBy(Array.from(merged.values()), [(device) => (device.adoptedDeviceId ? 1 : 0), 'name'], ['asc', 'asc']);
	});

	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => ({
			key: deviceKey(device),
			label: device.name || device.host,
			subLabel: device.mac,
			identifier: device.mac ?? device.host,
			status: device.adoptedDeviceId ? 'already_registered' : 'ready',
			adoptable: true,
			willUpdate: device.adoptedDeviceId !== null,
			suggestedName: device.name || device.host,
			suggestedCategory: DevicesModuleDeviceCategory.lighting,
			categoryOptions: [
				{
					value: DevicesModuleDeviceCategory.lighting,
					label: t(`devicesModule.categories.devices.${DevicesModuleDeviceCategory.lighting}`),
				},
			],
			cells: {
				host: { render: 'code', value: device.host },
			},
		}))
	);

	const results = computed<IWizardResult[]>(() =>
		adoptionResults.value.map((result) => {
			const device = devices.value.find((candidate) => adoptionHost(candidate) === result.host);
			return {
				key: device ? deviceKey(device) : `host:${result.host}`,
				name: result.name,
				identifier: device?.mac ?? result.host,
				status: result.status,
				error: result.error,
			};
		})
	);

	const applyInventory = (data: {
		mdnsEnabled: boolean;
		discoveryRunning: boolean;
		devices: Array<{ host: string; name: string; mac?: string | null; port: number; adoptedDeviceId?: string | null }>;
	}): void => {
		inventory.value = {
			mdnsEnabled: data.mdnsEnabled,
			discoveryRunning: data.discoveryRunning,
			devices: data.devices.map((device) => ({
				...device,
				mac: device.mac ?? null,
				adoptedDeviceId: device.adoptedDeviceId ?? null,
			})),
		};
		discoveryError.value = null;
	};

	const loadDiscovery = async (): Promise<void> => {
		const { data, error, response } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_WLED_PLUGIN_PREFIX}/discovery`);
		if (typeof data !== 'undefined') {
			applyInventory(data.data);
			return;
		}

		const reason = error
			? getErrorReason<DevicesWledPluginGetDiscoveryOperation>(error, t('devicesWledPlugin.wizard.messages.discoveryFailed'))
			: t('devicesWledPlugin.wizard.messages.discoveryFailed');
		throw new DevicesWledApiException(reason, response.status);
	};

	const stopPolling = (): void => {
		if (pollTimer !== null) {
			clearTimeout(pollTimer);
			pollTimer = null;
		}
	};

	const schedulePoll = (): void => {
		stopPolling();
		pollTimer = setTimeout(async () => {
			pollTimer = null;
			if (disposed) return;
			try {
				await loadDiscovery();
			} catch (error: unknown) {
				logger.warn('Failed to refresh WLED discovery inventory', error);
			}
			if (!disposed) schedulePoll();
		}, POLL_INTERVAL_MS);
	};

	const start = async (): Promise<void> => {
		disposed = false;
		formResult.value = FormResult.WORKING;
		try {
			await loadDiscovery();
			formResult.value = FormResult.NONE;
			if (disposed) return;
			schedulePoll();
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : t('devicesWledPlugin.wizard.messages.discoveryFailed');
			formResult.value = FormResult.ERROR;
			discoveryError.value = reason;
			flashMessage.error(reason);
			throw error;
		}
	};

	const performRescan = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;
		let rescanned;
		try {
			rescanned = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/rescan`);
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : t('devicesWledPlugin.wizard.messages.rescanFailed');
			formResult.value = FormResult.ERROR;
			flashMessage.error(reason);
			throw new DevicesWledApiException(reason, 0);
		}
		const { data, error, response } = rescanned;
		if (typeof data !== 'undefined') {
			generation.value += 1;
			manualDevices.value = [];
			adoptionResults.value = [];
			applyInventory(data.data);
			formResult.value = FormResult.NONE;
			return;
		}
		const reason = error
			? getErrorReason<DevicesWledPluginRescanDiscoveryOperation>(error, t('devicesWledPlugin.wizard.messages.rescanFailed'))
			: t('devicesWledPlugin.wizard.messages.rescanFailed');
		formResult.value = FormResult.ERROR;
		flashMessage.error(reason);
		throw new DevicesWledApiException(reason, response.status);
	};

	const rescan = (): Promise<void> => {
		if (rescanPromise !== null) return rescanPromise;
		rescanPromise = performRescan().finally(() => {
			rescanPromise = null;
		});
		return rescanPromise;
	};

	const probeManual = async (values: Record<string, string>): Promise<void> => {
		const host = (values.host ?? '').trim();
		if (!host) {
			const reason = t('devicesWledPlugin.fields.devices.hostname.validation.required');
			flashMessage.error(reason);
			throw new DevicesWledValidationException(reason);
		}

		formResult.value = FormResult.WORKING;
		let probed;
		try {
			probed = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/probe`, {
				body: { data: { host } },
			});
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : t('devicesWledPlugin.wizard.messages.probeFailed');
			formResult.value = FormResult.ERROR;
			flashMessage.error(reason);
			throw new DevicesWledApiException(reason, 0);
		}
		const { data, error, response } = probed;
		if (typeof data !== 'undefined') {
			const device = data.data;
			manualDevices.value = [
				...manualDevices.value.filter((candidate) => candidate.host !== device.host),
				{
					host: device.host,
					name: device.name,
					mac: device.mac ?? null,
					port: device.port,
					adoptedDeviceId: device.adoptedDeviceId ?? null,
				},
			];
			formResult.value = FormResult.NONE;
			return;
		}
		const reason = error
			? getErrorReason<DevicesWledPluginProbeDiscoveryOperation>(error, t('devicesWledPlugin.wizard.messages.probeFailed'))
			: t('devicesWledPlugin.wizard.messages.probeFailed');
		formResult.value = FormResult.ERROR;
		flashMessage.error(reason);
		throw new DevicesWledApiException(reason, response.status);
	};

	const controls = computed<IWizardControl[]>(() => {
		const items: IWizardControl[] = [];
		if (discoveryError.value) {
			items.push({ type: 'banner', id: 'error', severity: 'error', title: discoveryError.value });
		} else if (inventory.value?.mdnsEnabled === false) {
			items.push({
				type: 'banner',
				id: 'mdns-disabled',
				severity: 'info',
				title: t('devicesWledPlugin.wizard.mdnsDisabled.title'),
				message: t('devicesWledPlugin.wizard.mdnsDisabled.message'),
			});
		}
		items.push(
			{
				type: 'action',
				id: 'rescan',
				label: t('devicesWledPlugin.wizard.actions.rescan'),
				icon: 'mdi:radar',
				disabled: inventory.value?.mdnsEnabled === false || formResult.value === FormResult.WORKING,
				loading: formResult.value === FormResult.WORKING,
				handler: rescan,
			},
			{
				type: 'form',
				id: 'manual',
				fields: [
					{
						key: 'host',
						label: t('devicesWledPlugin.fields.devices.hostname.title'),
						placeholder: t('devicesWledPlugin.fields.devices.hostname.placeholder'),
					},
				],
				submitLabel: t('devicesWledPlugin.wizard.actions.probe'),
				submitIcon: 'mdi:lan-connect',
				submitDisabled: formResult.value === FormResult.WORKING,
				loading: formResult.value === FormResult.WORKING,
				handler: probeManual,
			}
		);
		return items;
	});

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		formResult.value = FormResult.WORKING;
		const selectedDevices = selection.flatMap((item) => {
			const device = devices.value.find((candidate) => deviceKey(candidate) === item.key);
			return device ? [{ item, device }] : [];
		});
		let adopted;
		try {
			adopted = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_WLED_PLUGIN_PREFIX}/discovery/adopt`, {
				body: {
					data: {
						devices: selectedDevices.map(({ item, device }) => ({
							host: adoptionHost(device),
							name: item.name,
							category: DevicesWledPluginAdoptDeviceCategory.lighting,
						})),
					},
				},
			});
		} catch (error: unknown) {
			const reason = error instanceof Error ? error.message : t('devicesWledPlugin.wizard.messages.adoptionFailed');
			formResult.value = FormResult.ERROR;
			flashMessage.error(reason);
			throw new DevicesWledApiException(reason, 0);
		}
		const { data, error, response } = adopted;
		if (typeof data !== 'undefined') {
			adoptionResults.value = data.data.map((result) => ({
				host: result.host,
				name: result.name,
				status: result.status,
				error: result.error ?? null,
			}));
			if (adoptionResults.value.some((result) => result.status === 'created' || result.status === 'updated')) {
				try {
					await devicesStore.fetch();
				} catch (error: unknown) {
					logger.warn('WLED devices were adopted, but the device store could not be refreshed', {
						message: error instanceof Error ? error.message : String(error),
					});
				}
			}
			formResult.value = adoptionResults.value.some((result) => result.status === 'failed') ? FormResult.ERROR : FormResult.OK;
			return results.value;
		}
		const reason = error
			? getErrorReason<DevicesWledPluginAdoptDiscoveryOperation>(error, t('devicesWledPlugin.wizard.messages.adoptionFailed'))
			: t('devicesWledPlugin.wizard.messages.adoptionFailed');
		formResult.value = FormResult.ERROR;
		flashMessage.error(reason);
		throw new DevicesWledApiException(reason, response.status);
	};

	const dispose = async (): Promise<void> => {
		disposed = true;
		stopPolling();
	};

	return {
		title: t('devicesWledPlugin.wizard.title'),
		subtitle: t('devicesWledPlugin.wizard.subtitle'),
		breadcrumbLabel: t('devicesWledPlugin.wizard.breadcrumb'),
		pluginType: DEVICES_WLED_PLUGIN_NAME,
		identifierLabel: t('devicesWledPlugin.wizard.columns.identifier'),
		rows,
		results,
		columns: [{ key: 'host', label: t('devicesWledPlugin.wizard.columns.host'), steps: ['discover'], minWidth: 160 }],
		controls,
		sessionKey: computed(() => String(generation.value)),
		ready: computed(() => inventory.value !== null || discoveryError.value !== null),
		busy: computed(() => formResult.value === FormResult.WORKING),
		capabilities: { addMore: true },
		start,
		adopt,
		restart: rescan,
		dispose,
	};
};
