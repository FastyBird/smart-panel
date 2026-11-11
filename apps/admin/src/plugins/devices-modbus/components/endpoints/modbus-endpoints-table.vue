<template>
	<el-table
		:data="endpoints"
		row-key="id"
		class="w-full"
	>
		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.name')"
			prop="name"
			min-width="160"
		/>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.address')"
			min-width="160"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">{{ row.host }}:{{ row.port }}</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.framing')"
			min-width="120"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				{{
					row.framing === DevicesModbusPluginFraming.rtu_over_tcp
						? t('devicesModbusPlugin.endpoints.framing.rtuOverTcp')
						: t('devicesModbusPlugin.endpoints.framing.tcp')
				}}
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.enabled')"
			width="90"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<el-switch
					:model-value="row.enabled"
					:aria-label="t('devicesModbusPlugin.endpoints.table.enabled')"
					@change="(value: string | number | boolean) => emit('toggle', row, value === true)"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.state')"
			min-width="120"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<el-tag
					v-if="health[row.id]"
					:type="stateTagType(health[row.id]!.state)"
				>
					{{ t(`devicesModbusPlugin.endpoints.state.${health[row.id]!.state}`) }}
				</el-tag>
				<el-tag
					v-else
					type="info"
					data-test-id="modbus-endpoint-state-unknown"
				>
					{{ t('devicesModbusPlugin.endpoints.state.unknown') }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.lastError')"
			min-width="200"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<template v-if="health[row.id]?.lastError">
					{{ health[row.id]!.lastError }}
					<span v-if="health[row.id]!.lastErrorAt">({{ health[row.id]!.lastErrorAt!.toLocaleString() }})</span>
				</template>
				<span v-else>-</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.latency')"
			width="110"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<template v-if="typeof health[row.id]?.averageLatencyMs === 'number'">{{ Math.round(health[row.id]!.averageLatencyMs!) }} ms</template>
				<span v-else>-</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.requests')"
			width="140"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<template v-if="health[row.id]">{{ health[row.id]!.requests }} / {{ health[row.id]!.timeouts }}</template>
				<span v-else>-</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.overloaded')"
			width="120"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<el-tag
					v-if="health[row.id]?.overloaded"
					type="warning"
				>
					{{ t('devicesModbusPlugin.endpoints.table.overloaded') }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.devices')"
			min-width="200"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<template v-if="devicesOf(row.id).length">
					{{ devicesOf(row.id).length }}:
					<template
						v-for="(device, index) in devicesOf(row.id)"
						:key="device.id"
					>
						<span v-if="index > 0">,</span>
						<router-link :to="{ name: DevicesRouteNames.DEVICE, params: { id: device.id } }">{{ device.name }}</router-link>
					</template>
				</template>
				<span v-else>0</span>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('devicesModbusPlugin.endpoints.table.actions')"
			width="180"
			align="right"
		>
			<template #default="{ row }: { row: IModbusEndpoint }">
				<el-button
					size="small"
					@click="emit('edit', row)"
				>
					{{ t('devicesModbusPlugin.endpoints.actions.edit') }}
				</el-button>
				<el-button
					size="small"
					type="danger"
					@click="emit('remove', row)"
				>
					{{ t('devicesModbusPlugin.endpoints.actions.remove') }}
				</el-button>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElSwitch, ElTable, ElTableColumn, ElTag } from 'element-plus';

import { RouteNames as DevicesRouteNames, type IDevice } from '../../../../modules/devices';
import { DevicesModbusPluginEndpointHealthState, DevicesModbusPluginFraming } from '../../../../openapi.constants';
import type { IModbusEndpoint } from '../../store/endpoints.types';

import type { IModbusEndpointsTableProps } from './modbus-endpoints-table.types';

defineOptions({
	name: 'ModbusEndpointsTable',
});

const props = defineProps<IModbusEndpointsTableProps>();

const emit = defineEmits<{
	(e: 'edit', endpoint: IModbusEndpoint): void;
	(e: 'remove', endpoint: IModbusEndpoint): void;
	(e: 'toggle', endpoint: IModbusEndpoint, enabled: boolean): void;
}>();

const { t } = useI18n();

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

// Grouped once per device list, so rendering a row is a lookup instead of a filter over every device.
const devicesByEndpoint = computed<Map<string, IDevice[]>>(() => {
	const grouped = new Map<string, IDevice[]>();

	for (const device of props.devices) {
		const endpointId = (device as IDevice & { endpointId?: string | null }).endpointId;

		if (endpointId) {
			const list = grouped.get(endpointId);

			if (list) {
				list.push(device);
			} else {
				grouped.set(endpointId, [device]);
			}
		}
	}

	return grouped;
});

const devicesOf = (endpointId: string): IDevice[] => devicesByEndpoint.value.get(endpointId) ?? [];
</script>
