import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { RouteNames as ConfigRouteNames } from '../../../modules/config';
import { devicesStoreKey } from '../../../modules/devices';
import type {
	IDeviceWizardAdapter,
	IWizardAdoptSelection,
	IWizardCell,
	IWizardControl,
	IWizardResult,
	IWizardRow,
	IWizardRowStatus,
} from '../../../modules/devices';
import { DevicesHomeyPluginAdoptionStatus } from '../../../openapi.constants';
import { DEVICES_HOMEY_PLUGIN_NAME, MAX_HOMEY_CONCURRENT_PREVIEWS, MAX_HOMEY_DEVICE_NAME_LENGTH } from '../devices-homey.constants';
import type { IHomeyAdoptSelection, IHomeyAdoptionResult, IHomeyInventoryDevice, IHomeyMappingPreview } from '../store/homey.types';
import { homeyInventoryStoreKey } from '../store/keys';

const mapWithConcurrencyLimit = async <T, R>(items: T[], task: (item: T) => Promise<R>): Promise<R[]> => {
	const results = new Array<R>(items.length);
	let nextIndex = 0;
	const worker = async (): Promise<void> => {
		while (nextIndex < items.length) {
			const currentIndex = nextIndex++;
			const item = items[currentIndex];
			if (item === undefined) return;

			results[currentIndex] = await task(item);
		}
	};

	await Promise.all(Array.from({ length: Math.min(MAX_HOMEY_CONCURRENT_PREVIEWS, items.length) }, () => worker()));

	return results;
};

const rowStatus = (device: IHomeyInventoryDevice, preview?: IHomeyMappingPreview, previewFailed = false): IWizardRowStatus => {
	if (previewFailed) return 'needs_attention';
	if (device.adopted) return 'already_registered';
	if (device.supportState === 'unsupported') return 'unsupported';
	if (device.supportState === 'conflicted' || !device.available || preview?.readyToAdopt === false) return 'needs_attention';
	return 'ready';
};

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();
	const devicesStore = storesManager.getStore(devicesStoreKey);
	const inventory = storesManager.getStore(homeyInventoryStoreKey);
	const error = ref<string | null>(null);
	const submittedNames = ref<Record<string, string>>({});
	const loading = ref(false);
	const adopting = ref(false);
	const previewsReady = ref(false);
	const previewFailures = ref<Record<string, true>>({});
	const sessionGeneration = ref(0);
	let loadPromise: Promise<void> | null = null;
	let loadAbortController: AbortController | null = null;
	const adoptionAbortControllers = new Set<AbortController>();
	let disposed = false;

	const mappingSummaryCell = (preview: IHomeyMappingPreview): IWizardCell => {
		const channels = preview.channels.length;
		const properties = preview.channels.reduce((count, channel) => count + channel.properties.length, 0);
		const warnings = preview.warnings.length;

		return {
			render: 'tag',
			value: t('devicesHomeyPlugin.wizard.values.mappingSummary', { channels, properties }),
			variant: warnings > 0 ? 'warning' : 'success',
			...(warnings > 0 ? { tooltip: t('devicesHomeyPlugin.wizard.values.mappingWarnings', { count: warnings }) } : {}),
		};
	};

	const devices = computed(() =>
		orderBy(
			inventory.findAll(),
			[(device) => rowStatus(device, inventory.previews[device.id], previewFailures.value[device.id]), (device) => device.name],
			['asc', 'asc']
		)
	);

	const rows = computed<IWizardRow[]>(() =>
		previewsReady.value
			? devices.value.map((device) => {
					const subLabel = [device.manufacturer, device.model].filter(Boolean).join(' · ') || device.class;
					const adoptedDevice = device.adoptedDeviceId ? devicesStore.findById(device.adoptedDeviceId) : null;
					const preview = inventory.previews[device.id];
					const previewFailed = previewFailures.value[device.id] === true;
					const status = rowStatus(device, preview, previewFailed);
					const adoptedCategoryIsValid =
						adoptedDevice !== null && (preview === undefined || preview.validCategories.includes(adoptedDevice.category));
					const suggestedCategory =
						(adoptedCategoryIsValid ? adoptedDevice.category : preview?.suggestedCategory) ?? device.suggestedCategory ?? null;
					const categories =
						preview?.validCategories ??
						[suggestedCategory, device.suggestedCategory].filter((category) => category !== null && category !== undefined);
					const categoryOptions = Array.from(new Set(categories)).map((category) => ({
						value: category,
						label: t(`devicesModule.categories.devices.${category}`),
					}));

					return {
						key: device.id,
						label: device.name,
						subLabel,
						identifier: device.id,
						status,
						statusLabel: !device.available
							? t('devicesHomeyPlugin.wizard.statuses.unavailable')
							: status === 'needs_attention'
								? t('devicesHomeyPlugin.wizard.statuses.needsAttention')
								: undefined,
						adoptable: !previewFailed && device.available && device.supportState === 'supported' && preview?.readyToAdopt === true,
						selectedByDefault: false,
						willUpdate: device.adopted,
						suggestedName: adoptedDevice?.name ?? device.name,
						suggestedCategory,
						categoryOptions,
						cells: {
							class: { render: 'text', value: device.class },
							zone: {
								render: 'text',
								value: device.zonePath.join(' / ') || t('devicesHomeyPlugin.wizard.values.noZone'),
								muted: !device.zonePath.length,
							},
							capabilities: {
								render: 'tag',
								value: t('devicesHomeyPlugin.wizard.values.capabilities', { count: device.capabilities.length }),
								variant: device.supportState === 'supported' ? 'success' : 'warning',
							},
							...(preview === undefined ? {} : { mapping: mappingSummaryCell(preview) }),
						},
					};
				})
			: []
	);

	const results = computed<IWizardResult[]>(() => inventory.adoptionResults.map(transformResult));

	const controls = computed<IWizardControl[]>(() => {
		const refresh: IWizardControl = {
			type: 'action',
			id: 'refresh',
			label: t('devicesHomeyPlugin.wizard.actions.refresh'),
			icon: 'mdi:refresh',
			loading: loading.value || inventory.fetching,
			disabled: loading.value || adopting.value || inventory.fetching || inventory.adopting,
			handler: restart,
		};

		if (!error.value) return [refresh];

		return [
			{
				type: 'banner',
				id: 'inventory-error',
				severity: 'warning',
				title: t('devicesHomeyPlugin.wizard.errors.inventory'),
				message: error.value,
				link: {
					label: t('devicesHomeyPlugin.wizard.actions.openConfig'),
					to: { name: ConfigRouteNames.CONFIG_PLUGIN_EDIT, params: { plugin: DEVICES_HOMEY_PLUGIN_NAME } },
				},
			},
			refresh,
		];
	});

	function load(): Promise<void> {
		if (loadPromise !== null) return loadPromise;
		if (disposed) return Promise.resolve();

		const abortController = new AbortController();
		loadAbortController = abortController;
		const currentLoad = (async () => {
			error.value = null;
			loading.value = true;
			previewsReady.value = false;
			previewFailures.value = {};
			inventory.adoptionResults = [];
			submittedNames.value = {};
			try {
				await devicesStore.fetch();
				abortController.signal.throwIfAborted();
				const inventoryDevices = await inventory.fetch({}, abortController.signal);
				const previewDevices = inventoryDevices.filter((device) => device.available && device.supportState === 'supported');
				const previewResults = await mapWithConcurrencyLimit(previewDevices, async (device) => {
					try {
						await inventory.preview(device.id, undefined, abortController.signal);
						return null;
					} catch {
						abortController.signal.throwIfAborted();
						return device.id;
					}
				});
				abortController.signal.throwIfAborted();
				previewFailures.value = Object.fromEntries(
					previewResults.filter((deviceId): deviceId is string => deviceId !== null).map((deviceId) => [deviceId, true as const])
				);
				previewsReady.value = true;
				sessionGeneration.value += 1;
			} catch (caught: unknown) {
				if (!abortController.signal.aborted) {
					error.value = caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.inventory');
				}
			} finally {
				loading.value = false;
				if (loadAbortController === abortController) loadAbortController = null;
			}
		})();
		loadPromise = currentLoad;
		void currentLoad.then(() => {
			if (loadPromise === currentLoad) loadPromise = null;
		});

		return currentLoad;
	}

	async function restart(): Promise<void> {
		if (loadPromise !== null) return loadPromise;

		inventory.adoptionResults = [];
		submittedNames.value = {};
		await load();
	}

	async function dispose(): Promise<void> {
		disposed = true;
		loadAbortController?.abort();
		for (const abortController of adoptionAbortControllers) abortController.abort();
	}

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		if (disposed) return [];

		const abortController = new AbortController();
		adoptionAbortControllers.add(abortController);
		submittedNames.value = Object.fromEntries(selection.map((item) => [item.key, item.name]));
		adopting.value = true;
		let preflightFailures: IHomeyAdoptionResult[] = [];

		try {
			const preparations = await mapWithConcurrencyLimit(selection, async (item) => {
				try {
					if (Array.from(item.name).length > MAX_HOMEY_DEVICE_NAME_LENGTH) {
						return {
							failure: {
								deviceId: item.key,
								status: DevicesHomeyPluginAdoptionStatus.failed,
								message: t('devicesHomeyPlugin.wizard.errors.nameTooLong', { max: MAX_HOMEY_DEVICE_NAME_LENGTH }),
							} satisfies IHomeyAdoptionResult,
						};
					}

					const inventoryDevice = inventory.findById(item.key);
					const adoptedDevice = inventoryDevice?.adoptedDeviceId ? devicesStore.findById(inventoryDevice.adoptedDeviceId) : null;

					if (inventoryDevice?.adopted && adoptedDevice === null) {
						return {
							failure: {
								deviceId: item.key,
								status: DevicesHomeyPluginAdoptionStatus.failed,
								message: t('devicesHomeyPlugin.wizard.errors.panelMetadataUnavailable'),
							} satisfies IHomeyAdoptionResult,
						};
					}

					const preview = inventoryDevice?.adopted ? await inventory.preview(item.key, undefined, abortController.signal) : null;
					if (preview !== null && !preview.validCategories.includes(item.category)) {
						return {
							failure: {
								deviceId: item.key,
								status: DevicesHomeyPluginAdoptionStatus.failed,
								message: t('devicesHomeyPlugin.wizard.errors.mappingChanged'),
							} satisfies IHomeyAdoptionResult,
						};
					}

					return {
						request: {
							deviceId: item.key,
							name: item.name,
							deviceCategory: item.category,
						} satisfies IHomeyAdoptSelection,
					};
				} catch (caught: unknown) {
					abortController.signal.throwIfAborted();
					return {
						failure: {
							deviceId: item.key,
							status: DevicesHomeyPluginAdoptionStatus.failed,
							message: caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.adoption'),
						} satisfies IHomeyAdoptionResult,
					};
				}
			});
			const requests = preparations.flatMap(({ request }) => (request === undefined ? [] : [request]));
			preflightFailures = preparations.flatMap(({ failure }) => (failure === undefined ? [] : [failure]));
			const adoption = requests.length > 0 ? await inventory.adoptBatch(requests, abortController.signal) : [];
			abortController.signal.throwIfAborted();
			const completed = new Map([...adoption, ...preflightFailures].map((result) => [result.deviceId, result]));
			inventory.adoptionResults = selection.flatMap((item) => {
				const result = completed.get(item.key);
				return result === undefined ? [] : [result];
			});

			return inventory.adoptionResults.map(transformResult);
		} catch (caught: unknown) {
			if (abortController.signal.aborted) return [];

			const failureMessage = caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.adoption');
			flashMessage.error(failureMessage);
			if (inventory.adoptionResults.length > 0 || preflightFailures.length > 0) {
				const completed = new Map([...inventory.adoptionResults, ...preflightFailures].map((result) => [result.deviceId, result]));
				inventory.adoptionResults = selection.map(
					(item): IHomeyAdoptionResult =>
						completed.get(item.key) ?? {
							deviceId: item.key,
							status: DevicesHomeyPluginAdoptionStatus.failed,
							message: failureMessage,
						}
				);

				return inventory.adoptionResults.map(transformResult);
			}
			throw caught;
		} finally {
			adoptionAbortControllers.delete(abortController);
			adopting.value = false;
		}
	};

	function transformResult(result: IHomeyAdoptionResult): IWizardResult {
		const device = inventory.findById(result.deviceId);
		return {
			key: result.deviceId,
			name: submittedNames.value[result.deviceId] ?? device?.name ?? result.deviceId,
			identifier: result.deviceId,
			status: result.status,
			error: result.message ?? null,
		};
	}

	return {
		title: t('devicesHomeyPlugin.wizard.title'),
		subtitle: t('devicesHomeyPlugin.wizard.subtitle'),
		breadcrumbLabel: t('devicesHomeyPlugin.wizard.breadcrumb'),
		pluginType: DEVICES_HOMEY_PLUGIN_NAME,
		identifierLabel: t('devicesHomeyPlugin.wizard.columns.identifier'),
		rows,
		results,
		columns: [
			{ key: 'class', label: t('devicesHomeyPlugin.wizard.columns.class'), steps: ['discover'], width: 140 },
			{ key: 'zone', label: t('devicesHomeyPlugin.wizard.columns.zone'), steps: ['discover'], minWidth: 160 },
			{ key: 'capabilities', label: t('devicesHomeyPlugin.wizard.columns.capabilities'), steps: ['discover'], width: 140 },
			{ key: 'mapping', label: t('devicesHomeyPlugin.wizard.columns.mapping'), steps: ['confirm'], minWidth: 220 },
		],
		controls,
		sessionKey: computed(() => (sessionGeneration.value === 0 ? null : `homey-session-${sessionGeneration.value}`)),
		ready: computed(() => previewsReady.value || error.value !== null),
		busy: computed(() => loading.value || adopting.value || inventory.fetching || inventory.adopting),
		capabilities: { addMore: true },
		start: load,
		adopt,
		restart,
		dispose,
	};
};
