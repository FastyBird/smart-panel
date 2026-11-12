<template>
	<el-card
		class="mt-2"
		shadow="never"
		data-test-id="modbus-device-section"
	>
		<template #header>
			<div class="flex items-center gap-2">
				<icon icon="mdi:lan-connect" />
				<strong>{{ t('devicesModbusPlugin.section.heading') }}</strong>
			</div>
		</template>

		<el-descriptions
			:column="1"
			border
			size="small"
		>
			<el-descriptions-item :label="t('devicesModbusPlugin.section.endpoint')">
				<template v-if="endpoint">
					<span data-test-id="modbus-section-endpoint">{{ endpoint.name }} ({{ endpoint.host }}:{{ endpoint.port }}, {{ framingLabel }})</span>
					<el-tag
						v-if="endpointHealth"
						class="ml-2"
						:type="stateTagType(endpointHealth.state)"
						data-test-id="modbus-section-state"
					>
						{{ t(`devicesModbusPlugin.endpoints.state.${endpointHealth.state}`) }}
					</el-tag>
				</template>
				<span v-else>{{ t('devicesModbusPlugin.section.endpointUnknown') }}</span>
				<el-link
					type="primary"
					underline="never"
					class="ml-2"
					data-test-id="modbus-section-endpoints-link"
					@click="onOpenEndpoints"
				>
					{{ t('devicesModbusPlugin.section.manageEndpoints') }}
				</el-link>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.section.unitId')">
				<span data-test-id="modbus-section-unit">{{ modbusDevice.unitId ?? '-' }}</span>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.section.pollInterval')">
				<span data-test-id="modbus-section-poll">
					{{
						modbusDevice.pollIntervalMs
							? t('devicesModbusPlugin.section.pollValue', { ms: modbusDevice.pollIntervalMs })
							: t('devicesModbusPlugin.section.pollDefault')
					}}
				</span>
			</el-descriptions-item>
			<el-descriptions-item :label="t('devicesModbusPlugin.section.template')">
				<span data-test-id="modbus-section-template">
					{{
						modbusDevice.templateId
							? t('devicesModbusPlugin.section.templateValue', { id: modbusDevice.templateId, revision: modbusDevice.templateRevision ?? '-' })
							: t('devicesModbusPlugin.section.templateCustom')
					}}
				</span>
			</el-descriptions-item>
		</el-descriptions>

		<div class="flex items-center justify-between mt-4 mb-2">
			<strong>{{ t('devicesModbusPlugin.section.bindings.heading') }}</strong>
			<el-button
				size="small"
				:loading="reading"
				:disabled="!canRead || loading || !hasReadBindings"
				data-test-id="modbus-section-read-now"
				@click="onReadNow"
			>
				{{ t('devicesModbusPlugin.section.readNow') }}
			</el-button>
		</div>
		<el-text
			size="small"
			type="info"
			class="block mb-2"
		>
			{{ canRead ? t('devicesModbusPlugin.section.readNowHint') : t('devicesModbusPlugin.section.readNoUnit') }}
		</el-text>

		<el-alert
			v-if="readError"
			type="error"
			:title="readError"
			:closable="false"
			show-icon
			class="mb-2"
			data-test-id="modbus-section-read-error"
		/>

		<el-alert
			v-if="loadError"
			type="error"
			:title="loadError"
			:closable="false"
			show-icon
			data-test-id="modbus-section-bindings-error"
		/>

		<el-table
			v-else
			v-loading="loading"
			:data="bindings"
			row-key="id"
			size="small"
			class="w-full"
			:empty-text="t('devicesModbusPlugin.section.bindings.empty')"
		>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.property')"
				min-width="160"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">{{ propertyName(row.propertyId) }}</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.role')"
				width="90"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">{{ t(`devicesModbusPlugin.section.bindings.roles.${row.role}`) }}</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.registerType')"
				min-width="130"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">
					{{ t(`devicesModbusPlugin.wizard.probe.registerType.${row.binding.registerType}`) }}
				</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.address')"
				width="110"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">
					<span class="font-mono">{{ formatAddress(row.binding.address, row.binding.registerType, 'pdu') }}</span>
				</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.dataType')"
				width="100"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">{{ row.binding.dataType }}</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.bit')"
				width="60"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">{{ row.binding.bit ?? '-' }}</template>
			</el-table-column>
			<el-table-column
				:label="t('devicesModbusPlugin.section.bindings.maps')"
				min-width="150"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">{{ mappingSummary(row.binding) }}</template>
			</el-table-column>
			<el-table-column
				v-if="readings"
				:label="t('devicesModbusPlugin.section.bindings.raw')"
				min-width="100"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">
					<span
						v-if="readings[row.id]?.error"
						class="text-red-500"
						:data-test-id="`modbus-section-error-${row.id}`"
					>
						{{ readings[row.id]!.error }}
					</span>
					<span
						v-else
						class="font-mono"
						:data-test-id="`modbus-section-raw-${row.id}`"
					>
						{{ readings[row.id]?.raw ? readings[row.id]!.raw!.join(', ') : '-' }}
					</span>
				</template>
			</el-table-column>
			<el-table-column
				v-if="readings"
				:label="t('devicesModbusPlugin.section.bindings.decoded')"
				min-width="100"
			>
				<template #default="{ row }: { row: IModbusDeviceBinding }">
					<span :data-test-id="`modbus-section-decoded-${row.id}`">{{ readings[row.id]?.value ?? '-' }}</span>
				</template>
			</el-table-column>
		</el-table>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElAlert, ElButton, ElCard, ElDescriptions, ElDescriptionsItem, ElLink, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectStoresManager, snakeToCamel, useBackend, useLogger } from '../../../common';
import { channelsPropertiesStoreKey, channelsStoreKey } from '../../../modules/devices/store/keys';
import type { DevicesModbusPluginGetDeviceBindingsOperation } from '../../../openapi.constants';
import { DevicesModbusPluginByteOrder, DevicesModbusPluginEndpointHealthState, DevicesModbusPluginFraming } from '../../../openapi.constants';
import { useModbusProbe } from '../composables/useModbusProbe';
import { DEVICES_MODBUS_PLUGIN_PREFIX, RouteNames } from '../devices-modbus.constants';
import { formatAddress } from '../lib/address-notation';
import type { ModbusPointBinding } from '../lib/points';
import { explainProbeError } from '../lib/probe-messages';
import { modbusEndpointsStoreKey } from '../store/keys';

import type { IModbusBindingReading, IModbusDeviceBinding, IModbusDeviceSectionProps } from './modbus-device-section.types';

defineOptions({
	name: 'ModbusDeviceSection',
});

const props = defineProps<IModbusDeviceSectionProps>();

const { t } = useI18n();
const router = useRouter();
const backend = useBackend();
const logger = useLogger();
const probe = useModbusProbe();
const storesManager = injectStoresManager();

const endpointsStore = storesManager.getStore(modbusEndpointsStoreKey);
const channelsStore = storesManager.getStore(channelsStoreKey);
const propertiesStore = storesManager.getStore(channelsPropertiesStoreKey);

// The modbus fields are on the device because the plugin registered its device schema.
const modbusDevice = computed(
	() =>
		props.device as unknown as {
			endpointId?: string | null;
			unitId?: number | null;
			pollIntervalMs?: number | null;
			byteOrder?: DevicesModbusPluginByteOrder;
			wordOrder?: DevicesModbusPluginByteOrder;
			templateId?: string | null;
			templateRevision?: string | null;
			maxReadRegisters?: number | null;
			maxReadBits?: number | null;
			maxReadGap?: number | null;
		}
);

const endpoint = computed(() => (modbusDevice.value.endpointId ? endpointsStore.findById(modbusDevice.value.endpointId) : null));
const endpointHealth = computed(() => (modbusDevice.value.endpointId ? (endpointsStore.health[modbusDevice.value.endpointId] ?? null) : null));
const framingLabel = computed(() =>
	endpoint.value?.framing === DevicesModbusPluginFraming.rtu_over_tcp
		? t('devicesModbusPlugin.endpoints.framing.rtuOverTcp')
		: t('devicesModbusPlugin.endpoints.framing.tcp')
);

const stateTagType = (state: DevicesModbusPluginEndpointHealthState): 'success' | 'warning' | 'info' => {
	switch (state) {
		case DevicesModbusPluginEndpointHealthState.connected:
			return 'success';
		case DevicesModbusPluginEndpointHealthState.connecting:
		case DevicesModbusPluginEndpointHealthState.backoff:
			return 'warning';
		default:
			return 'info';
	}
};

const bindings = ref<IModbusDeviceBinding[]>([]);
const loading = ref<boolean>(false);
const loadError = ref<string | null>(null);

const readings = ref<Record<string, IModbusBindingReading> | null>(null);
const reading = ref<boolean>(false);
const readError = ref<string | null>(null);

const canRead = computed<boolean>(
	() => !!modbusDevice.value.endpointId && modbusDevice.value.unitId !== null && modbusDevice.value.unitId !== undefined
);

const hasReadBindings = computed<boolean>(() => bindings.value.some((item) => item.role === 'read'));

const propertyName = (propertyId: string): string => {
	for (const channel of channelsStore.findForDevice(props.device.id)) {
		const property = propertiesStore.findForChannel(channel.id).find((item) => item.id === propertyId);

		if (property) {
			return property.name ?? property.identifier ?? property.category;
		}
	}

	return propertyId;
};

const mappingSummary = (binding: ModbusPointBinding): string => {
	if (binding.valueMap) {
		return t('devicesModbusPlugin.section.bindings.valueMap', { count: binding.valueMap.length });
	}

	const parts: string[] = [];

	if (binding.scale !== 1 || binding.offset !== 0) {
		parts.push(t('devicesModbusPlugin.section.bindings.scaleOffset', { scale: binding.scale, offset: binding.offset }));
	}

	if (binding.invert) {
		parts.push(t('devicesModbusPlugin.section.bindings.invert'));
	}

	return parts.length > 0 ? parts.join(', ') : '-';
};

const toBinding = (wire: Record<string, unknown>): IModbusDeviceBinding => {
	const camel = snakeToCamel(wire) as Partial<ModbusPointBinding> &
		Pick<ModbusPointBinding, 'registerType' | 'address' | 'dataType'> &
		Pick<IModbusDeviceBinding, 'id' | 'role'> & { propertyId: string };

	return {
		id: camel.id,
		propertyId: camel.propertyId,
		role: camel.role,
		binding: {
			registerType: camel.registerType,
			address: camel.address,
			dataType: camel.dataType,
			bit: camel.bit ?? null,
			byteOrder: camel.byteOrder ?? null,
			wordOrder: camel.wordOrder ?? null,
			scale: camel.scale ?? 1,
			offset: camel.offset ?? 0,
			invert: camel.invert ?? false,
			valueMap: camel.valueMap ?? null,
			writeFunction: camel.writeFunction ?? null,
			pollIntervalMs: camel.pollIntervalMs ?? null,
			longPressMs: camel.longPressMs ?? null,
		},
	};
};

const fetchBindings = async (): Promise<void> => {
	loading.value = true;
	loadError.value = null;

	try {
		const { data: responseData, error } = await backend.client.GET(`/${PLUGINS_PREFIX}/${DEVICES_MODBUS_PLUGIN_PREFIX}/devices/{id}/bindings`, {
			params: { path: { id: props.device.id } },
		});

		if (!responseData) {
			loadError.value = getErrorReason<DevicesModbusPluginGetDeviceBindingsOperation>(error, t('devicesModbusPlugin.section.bindings.loadFailed'));

			return;
		}

		bindings.value = responseData.data.map((item) => toBinding(item as unknown as Record<string, unknown>));
	} catch (err: unknown) {
		logger.error('Failed to load the Modbus device bindings', err);

		loadError.value = t('devicesModbusPlugin.section.bindings.loadFailed');
	} finally {
		loading.value = false;
	}
};

const onReadNow = async (): Promise<void> => {
	const endpointId = modbusDevice.value.endpointId;
	const unitId = modbusDevice.value.unitId;

	if (!endpointId || unitId === null || unitId === undefined) {
		return;
	}

	const readBindings = bindings.value.filter((item) => item.role === 'read');

	if (reading.value || readBindings.length === 0) {
		return;
	}

	reading.value = true;
	readError.value = null;

	try {
		const result = await probe.readPoints(
			{ endpoint_id: endpointId },
			unitId,
			readBindings.map((item) => ({ key: item.id, read: item.binding })),
			{
				byteOrder: modbusDevice.value.byteOrder ?? DevicesModbusPluginByteOrder.big,
				wordOrder: modbusDevice.value.wordOrder ?? DevicesModbusPluginByteOrder.big,
			},
			{
				maxReadRegisters: modbusDevice.value.maxReadRegisters,
				maxReadBits: modbusDevice.value.maxReadBits,
				maxReadGap: modbusDevice.value.maxReadGap,
			}
		);

		if (result.error) {
			readError.value = t('devicesModbusPlugin.section.readFailed', { reason: t(explainProbeError(result.error)) });
		}

		if (result.points.length === 0) {
			if (result.error) {
				// Values from an earlier read must not stay on screen as if they were current.
				readings.value = null;
			}

			return;
		}

		readings.value = Object.fromEntries(
			readBindings.map((item): [string, IModbusBindingReading] => {
				const point = result.points.find((entry) => entry.key === item.id);

				return [item.id, { raw: point?.raw ?? null, value: point?.value ?? null, error: point?.error ? t(explainProbeError(point.error)) : null }];
			})
		);
	} catch (err: unknown) {
		logger.error('Failed to read the Modbus device bindings', err);

		readError.value = t('devicesModbusPlugin.section.readFailed', { reason: '' });
	} finally {
		reading.value = false;
	}
};

const onOpenEndpoints = (): void => {
	router.push({ name: RouteNames.ENDPOINTS }).catch((err: unknown): void => logger.error('Failed to open the Modbus endpoints page', err));
};

onMounted(async (): Promise<void> => {
	const endpointId = modbusDevice.value.endpointId;

	if (endpointId) {
		try {
			if (!endpointsStore.findById(endpointId)) {
				await endpointsStore.fetch();
			}

			await endpointsStore.fetchHealth(endpointId);
		} catch (err: unknown) {
			logger.error('Failed to load the Modbus endpoint of the device', err);
		}
	}
});

onMounted(fetchBindings);
</script>
