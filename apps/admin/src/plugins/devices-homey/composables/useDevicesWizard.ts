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
import { DEVICES_HOMEY_PLUGIN_NAME } from '../devices-homey.constants';
import type { IHomeyAdoptionResult, IHomeyInventoryDevice } from '../store/homey.types';
import { homeyInventoryStoreKey } from '../store/keys';

const rowStatus = (device: IHomeyInventoryDevice): IWizardRowStatus => {
	if (device.adopted) return 'already_registered';
	if (device.supportState === 'unsupported') return 'unsupported';
	if (device.supportState === 'conflicted' || !device.available) return 'needs_attention';
	return 'ready';
};

export const useDevicesWizard = (): IDeviceWizardAdapter => {
	const { t } = useI18n();
	const flashMessage = useFlashMessage();
	const storesManager = injectStoresManager();
	const devicesStore = storesManager.getStore(devicesStoreKey);
	const inventory = storesManager.getStore(homeyInventoryStoreKey);
	const error = ref<string | null>(null);

	const devices = computed(() => orderBy(inventory.findAll(), [(device) => rowStatus(device), (device) => device.name], ['asc', 'asc']));

	const rows = computed<IWizardRow[]>(() =>
		devices.value.map((device) => {
			const status = rowStatus(device);
			const subLabel = [device.manufacturer, device.model].filter(Boolean).join(' · ') || device.class;
			const adoptedDevice = device.adoptedDeviceId ? devicesStore.findById(device.adoptedDeviceId) : null;
			const preview = inventory.previews[device.id];
			const adoptedCategoryIsValid = adoptedDevice !== null && (preview === undefined || preview.validCategories.includes(adoptedDevice.category));
			const suggestedCategory = (adoptedCategoryIsValid ? adoptedDevice.category : preview?.suggestedCategory) ?? device.suggestedCategory ?? null;
			const categories =
				preview?.validCategories ?? [suggestedCategory, device.suggestedCategory].filter((category) => category !== null && category !== undefined);
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
				adoptable: device.available && device.supportState === 'supported',
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
	);

	const results = computed<IWizardResult[]>(() => inventory.adoptionResults.map(transformResult));

	const controls = computed<IWizardControl[]>(() => {
		const refresh: IWizardControl = {
			type: 'action',
			id: 'refresh',
			label: t('devicesHomeyPlugin.wizard.actions.refresh'),
			icon: 'mdi:refresh',
			loading: inventory.fetching,
			disabled: inventory.adopting,
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
		try {
			const [, inventoryDevices] = await Promise.all([devicesStore.fetch(), inventory.fetch()]);
			await Promise.all(
				inventoryDevices
					.filter((device) => {
						const adoptedDevice = device.adoptedDeviceId ? devicesStore.findById(device.adoptedDeviceId) : null;
						return device.adopted && adoptedDevice !== null && adoptedDevice.category !== device.suggestedCategory;
					})
					.map((device) => inventory.preview(device.id))
			);
		} catch (caught: unknown) {
			error.value = caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.inventory');
		}
	}

	async function restart(): Promise<void> {
		inventory.adoptionResults = [];
		await load();
	}

	const adopt = async (selection: IWizardAdoptSelection[]): Promise<IWizardResult[]> => {
		try {
			const requests = await Promise.all(
				selection.map(async (item) => {
					const inventoryDevice = inventory.findById(item.key);
					const adoptedDevice = inventoryDevice?.adoptedDeviceId ? devicesStore.findById(inventoryDevice.adoptedDeviceId) : null;

					if (inventoryDevice?.adopted && adoptedDevice === null) {
						return { deviceId: item.key };
					}

					const preview = inventoryDevice?.adopted ? (inventory.previews[item.key] ?? (await inventory.preview(item.key))) : null;
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
			flashMessage.error(caught instanceof Error ? caught.message : t('devicesHomeyPlugin.wizard.errors.adoption'));
			throw caught;
		}
	};

	function transformResult(result: IHomeyAdoptionResult): IWizardResult {
		const device = inventory.findById(result.deviceId);
		return {
			key: result.deviceId,
			name: device?.name ?? result.deviceId,
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
		ready: computed(() => inventory.firstLoad || error.value !== null),
		busy: computed(() => inventory.fetching || inventory.adopting),
		capabilities: { addMore: true },
		start: load,
		adopt,
		restart,
		dispose: async () => undefined,
	};
};
