import { type ComputedRef, type Reactive, computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';
import { v4 as uuid } from 'uuid';

import { tryOnMounted, tryOnUnmounted } from '@vueuse/core';

import { getErrorReason, injectStoresManager, useBackend, useFlashMessage } from '../../../common';
import { PLUGINS_PREFIX } from '../../../app.constants';
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
	status: 'created' | 'failed';
	error: string | null;
}

export interface IUseDevicesWizard {
	session: ComputedRef<IShellyNgDiscoverySession | null>;
	devices: ComputedRef<IShellyNgDiscoveryDevice[]>;
	selectedDevices: ComputedRef<IShellyNgDiscoveryDevice[]>;
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

	let pollingTimer: number | null = null;

	const devices = computed<IShellyNgDiscoveryDevice[]>(() =>
		orderBy(session.value?.devices ?? [], [(device) => device.status === 'ready' ? 0 : 1, (device) => device.hostname], ['asc', 'asc'])
	);

	const selectedDevices = computed<IShellyNgDiscoveryDevice[]>(() =>
		devices.value.filter(
			(device) => selected[device.hostname] === true && device.status === 'ready' && categoryByHostname[device.hostname] !== null
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
		session.value = nextSession;

		for (const device of nextSession.devices) {
			if (selected[device.hostname] === undefined) {
				selected[device.hostname] = device.status === 'ready';
			}

			if (categoryByHostname[device.hostname] === undefined) {
				categoryByHostname[device.hostname] = device.suggestedCategory;
			}

			if (nameByHostname[device.hostname] === undefined) {
				nameByHostname[device.hostname] = device.name ?? device.displayName ?? device.hostname;
			}
		}

		if (nextSession.status !== 'running') {
			stopPolling();
		}
	};

	const startDiscovery = async (): Promise<void> => {
		formResult.value = FormResult.WORKING;

		const {
			data: responseData,
			error,
			response,
		} = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_SHELLY_NG_PLUGIN_PREFIX}/devices/discovery`);

		if (typeof responseData !== 'undefined') {
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
			? getErrorReason<DevicesShellyNgPluginCreateDiscoveryManualOperation>(
					error,
					t('devicesShellyNgPlugin.messages.wizard.manualNotAdded')
				)
			: t('devicesShellyNgPlugin.messages.wizard.manualNotAdded');

		formResult.value = FormResult.ERROR;
		flashMessage.error(errorReason);

		throw new DevicesShellyNgApiException(errorReason, response.status);
	};

	const adoptSelected = async (): Promise<IShellyNgWizardAdoptionResult[]> => {
		formResult.value = FormResult.WORKING;

		const results: IShellyNgWizardAdoptionResult[] = [];

		for (const device of selectedDevices.value) {
			const id = uuid().toString();
			const name = nameByHostname[device.hostname] || device.name || device.displayName || device.hostname;

			try {
				await devicesStore.add({
					id,
					draft: false,
					data: {
						id,
						type: DEVICES_SHELLY_NG_TYPE,
						category: categoryByHostname[device.hostname] as DevicesModuleDeviceCategory,
						identifier: device.identifier,
						name,
						description: null,
						enabled: true,
						password: passwordByHostname[device.hostname] ?? null,
						wifiAddress: device.hostname,
					},
				});

				results.push({
					hostname: device.hostname,
					name,
					status: 'created',
					error: null,
				});
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
