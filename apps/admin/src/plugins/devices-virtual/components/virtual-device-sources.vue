<template>
	<el-card
		class="mt-2"
		shadow="never"
		data-test-id="virtual-device-sources"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<icon icon="mdi:source-branch" />
				<strong>{{ t('devicesVirtualPlugin.sources.heading') }}</strong>
			</div>
		</template>

		<el-text
			size="small"
			type="info"
			class="block mb-3"
		>
			{{ t('devicesVirtualPlugin.sources.description') }}
		</el-text>

		<div
			v-if="warnings.length > 0"
			class="space-y-2 mb-3"
		>
			<el-alert
				v-for="warning in warnings"
				:key="warning.propertyId"
				type="warning"
				:title="warningTitle(warning)"
				:description="t('devicesVirtualPlugin.sources.warning.description')"
				:closable="false"
				show-icon
				:data-test-id="`source-warning-${warning.propertyId}`"
			>
				<el-button
					size="small"
					type="warning"
					plain
					:data-test-id="`remap-${warning.propertyId}`"
					@click="onRemap(warning)"
				>
					{{ t('devicesVirtualPlugin.sources.warning.remap') }}
				</el-button>
			</el-alert>
		</div>

		<div v-loading="loading">
			<el-alert
				v-if="loadError"
				type="error"
				:title="loadError"
				:closable="false"
				show-icon
				data-test-id="sources-error"
			>
				<el-button
					size="small"
					data-test-id="sources-retry"
					@click="onRetry"
				>
					{{ t('devicesVirtualPlugin.sources.retry') }}
				</el-button>
			</el-alert>

			<el-text
				v-else-if="!loading && sourceDevices.length === 0"
				size="small"
				type="info"
				data-test-id="sources-empty"
			>
				{{ t('devicesVirtualPlugin.sources.empty') }}
			</el-text>

			<ul
				v-else
				class="list-none p-0 m-0 space-y-1"
				data-test-id="sources-list"
			>
				<li
					v-for="sourceDevice in sourceDevices"
					:key="sourceDevice.id"
				>
					<el-link
						type="primary"
						:underline="false"
						@click="onViewSourceDevice(sourceDevice.id)"
					>
						<icon
							icon="mdi:devices"
							class="mr-1"
						/>
						{{ sourceDevice.name }}
					</el-link>
				</li>
			</ul>
		</div>
	</el-card>

	<virtual-device-remap-dialog
		v-if="remapTarget"
		:property-id="remapTarget.propertyId"
		@close="remapTarget = null"
		@remapped="onRemapped"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElCard, ElLink, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, useBackend, useLogger } from '../../../common';
import type { IChannel, IDevice } from '../../../modules/devices';
import { DeviceSchema, RouteNames as DevicesRouteNames, transformDeviceResponse } from '../../../modules/devices';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices/store/keys';
import type { DevicesVirtualPluginGetDeviceSourceDevicesOperation } from '../../../openapi.constants';
import { DevicesVirtualPluginValueOrigin } from '../../../openapi.constants';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';
import type { IVirtualChannelProperty } from '../store/channels.properties.store.types';

import VirtualDeviceRemapDialog from './virtual-device-remap-dialog.vue';
import type { IVirtualDeviceSourcesProps, IVirtualSourceWarning } from './virtual-device-sources.types';

defineOptions({
	name: 'VirtualDeviceSources',
});

const props = defineProps<IVirtualDeviceSourcesProps>();

const { t } = useI18n();
const router = useRouter();
const backend = useBackend();
const logger = useLogger();
const storesManager = injectStoresManager();

const channelsStore = storesManager.getStore(channelsStoreKey);
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

const sourceDevices = ref<IDevice[]>([]);
const loading = ref<boolean>(false);
const loadError = ref<string | null>(null);

const remapTarget = ref<IVirtualSourceWarning | null>(null);

const channels = computed<IChannel[]>((): IChannel[] => channelsStore.findForDevice(props.device.id));

// The orphan condition: `valueOrigin: 'source'` means the property is *supposed* to project another
// property's value; `sourceProperty: null` means the FK the backend sets null on delete. A `'local'`
// property with a null source never had one to begin with — that is normal, not degraded, and is not
// flagged. Every property on this virtual device's own channels was created through the virtual
// plugin's schema, so it carries `valueOrigin`/`sourceProperty` at runtime even though the shared
// store's generic map type does not know that statically — the cast bridges the two.
const warnings = computed<IVirtualSourceWarning[]>((): IVirtualSourceWarning[] =>
	channels.value.flatMap((channel: IChannel): IVirtualSourceWarning[] =>
		(propertiesStore.findForChannel(channel.id) as IVirtualChannelProperty[])
			.filter(
				(property: IVirtualChannelProperty): boolean =>
					property.valueOrigin === DevicesVirtualPluginValueOrigin.source && property.sourceProperty === null
			)
			.map(
				(property: IVirtualChannelProperty): IVirtualSourceWarning => ({
					action: 'remap',
					propertyId: property.id,
					specChannel: channel.category,
					specProperty: property.category,
				})
			)
	)
);

const warningTitle = (warning: IVirtualSourceWarning): string =>
	t('devicesVirtualPlugin.sources.warning.title', {
		channel: t(`devicesModule.categories.channels.${warning.specChannel}`),
		property: t(`devicesModule.categories.channelsProperties.${warning.specProperty}`),
	});

const fetchSourceDevices = async (): Promise<void> => {
	loading.value = true;
	loadError.value = null;

	try {
		const { data: responseData, error } = await backend.client.GET(
			`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/devices/{id}/source-devices`,
			{
				params: { path: { id: props.device.id } },
			}
		);

		if (!responseData) {
			// An empty *result* is a legitimate answer this endpoint documents (a virtual device built only
			// from owned properties draws from nothing) and must read as "nothing here", not as broken. A
			// failed *call* is the opposite: it must never be presented as "this device draws from
			// nothing", since that is a specific, meaningful answer this is not.
			loadError.value = error
				? getErrorReason<DevicesVirtualPluginGetDeviceSourceDevicesOperation>(error, t('devicesVirtualPlugin.sources.loadFailed'))
				: t('devicesVirtualPlugin.sources.loadFailed');

			return;
		}

		sourceDevices.value = responseData.data.map((entry) => transformDeviceResponse(entry, DeviceSchema));
	} catch (err: unknown) {
		logger.error('Failed to load virtual device source devices', err);

		loadError.value = t('devicesVirtualPlugin.sources.loadFailed');
	} finally {
		loading.value = false;
	}
};

const onRetry = (): void => {
	fetchSourceDevices().catch((err: unknown): void => logger.error('Failed to retry loading virtual device source devices', err));
};

// The property store update clears the orphan warning on its own, but the source-device list is a
// separate snapshot from the source-devices endpoint: without refetching it, a device the remap has
// just linked stays listed as absent until the whole detail page is reloaded.
const onRemapped = (): void => {
	remapTarget.value = null;

	fetchSourceDevices().catch((err: unknown): void => logger.error('Failed to reload virtual device source devices after a remap', err));
};

const onViewSourceDevice = (deviceId: IDevice['id']): void => {
	router
		.push({ name: DevicesRouteNames.DEVICE, params: { id: deviceId } })
		.catch((err: unknown): void => logger.error('Failed to open source device', err));
};

const onRemap = (warning: IVirtualSourceWarning): void => {
	remapTarget.value = warning;
};

onBeforeMount((): void => {
	// Defensive, not load-bearing: the device detail view that mounts this panel already fetches this
	// device's channels (and, cascaded, their properties) for its own channel list. `channelsStore.fetch`
	// dedupes concurrent calls for the same device id, so this costs nothing when that fetch is already
	// in flight and keeps this panel correct on its own if it is ever mounted without that sibling.
	channelsStore.fetch({ deviceId: props.device.id }).catch((err: unknown): void => logger.error('Failed to load virtual device channels', err));

	fetchSourceDevices().catch((err: unknown): void => logger.error('Failed to load virtual device source devices', err));
});

defineExpose({
	warnings,
	sourceDevices,
	loading,
	loadError,
	remapTarget,
	onRemap,
	onRetry,
	fetchSourceDevices,
});
</script>
