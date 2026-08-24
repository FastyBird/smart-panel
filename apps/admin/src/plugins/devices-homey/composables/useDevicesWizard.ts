import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { orderBy } from 'natural-orderby';

import { injectStoresManager, useFlashMessage } from '../../../common';
import { RouteNames as ConfigRouteNames } from '../../../modules/config';
import { devicesStoreKey } from '../../../modules/devices';
import type {
	IDeviceWizardAdapter,
	IWizardAdoptSelection,
	IWizardControl,
	IWizardResult,
	IWizardRow,
	IWizardRowStatus,
} from '../../../modules/devices';
import { DevicesHomeyPluginAdoptionStatus } from '../../../openapi.constants';
import { DEVICES_HOMEY_PLUGIN_NAME, MAX_HOMEY_CONCURRENT_PREVIEWS } from '../devices-homey.constants';
import type { IHomeyAdoptionResult, IHomeyInventoryDevice, IHomeyMappingPreview } from '../store/homey.types';
import { homeyInventoryStoreKey } from '../store/keys';

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
						statusLabel: !device.available ? t('devicesHomeyPlugin.wizard.statuses.unavailable') : undefined,
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
			loading: inventory.fetching,
			disabled: adopting.value || inventory.adopting,
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

	async function load(): Promise<void> {
		error.value = null;
		loading.value = true;
		previewsReady.value = false;
		previewFailures.value = {};
		try {
			await devicesStore.fetch();
			const inventoryDevices = await inventory.fetch();
			const previewDevices = inventoryDevices.filter((device) => device.available && device.supportState === 'supported');
			const failedPreviews: string[] = [];
			let nextPreviewIndex = 0;
			const previewWorker = async (): Promise<void> => {
				while (nextPreviewIndex < previewDevices.length) {
					const device = previewDevices[nextPreviewIndex++];
					if (device === undefined) return;

					try {
						await inventory.preview(device.id);
					} catch {
						failedPreviews.push(device.id);
					}
				}
			};
			await Promise.all(Array.from({ length: Math.min(MAX_HOMEY_CONCURRENT_PREVIEWS, previewDevices.length) }, () => previewWorker()));
			previewFailures.value = Object.fromEntries(failedPreviews.map((deviceId) => [deviceId, true as const]));
			previewsReady.value = true;
		} catch (caught: unknown) {
			error.value = caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.inventory');
		} finally {
			loading.value = false;
		}
	}

	async function restart(): Promise<void> {
		inventory.adoptionResults = [];
		submittedNames.value = {};
		await load();
	}

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		submittedNames.value = Object.fromEntries(selection.map((item) => [item.key, item.name]));
		adopting.value = true;

		try {
			const requests = await Promise.all(
				selection.map(async (item) => {
					const inventoryDevice = inventory.findById(item.key);
					const adoptedDevice = inventoryDevice?.adoptedDeviceId ? devicesStore.findById(inventoryDevice.adoptedDeviceId) : null;

					if (inventoryDevice?.adopted && adoptedDevice === null) {
						return { deviceId: item.key };
					}

					const preview = inventoryDevice?.adopted ? await inventory.preview(item.key) : null;
					const deviceCategory = preview?.validCategories.includes(item.category) === false ? undefined : item.category;

					return {
						deviceId: item.key,
						name: item.name,
						...(deviceCategory === undefined ? {} : { deviceCategory }),
					};
				})
			);
			const adoption = await inventory.adoptBatch(requests);

			return adoption.map(transformResult);
		} catch (caught: unknown) {
			const failureMessage = caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.adoption');
			flashMessage.error(failureMessage);
			if (inventory.adoptionResults.length > 0) {
				const completed = new Map(inventory.adoptionResults.map((result) => [result.deviceId, result]));
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
		],
		controls,
		ready: computed(() => previewsReady.value || error.value !== null),
		busy: computed(() => loading.value || adopting.value || inventory.fetching || inventory.adopting),
		capabilities: { addMore: true },
		start: load,
		adopt,
		restart,
		dispose: async () => undefined,
	};
};
