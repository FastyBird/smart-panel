<template>
	<el-table
		v-loading="props.loading"
		:element-loading-text="t('mcpModule.clients.loading')"
		:data="props.items"
		:default-sort="
			typeof props.sortBy !== 'undefined' && props.sortDir !== null
				? { prop: props.sortBy, order: props.sortDir === 'desc' ? 'descending' : 'ascending' }
				: undefined
		"
		table-layout="fixed"
		row-key="id"
		class="flex-grow"
		:style="{ maxHeight: props.tableHeight + 'px' }"
		:max-height="props.tableHeight"
		@sort-change="onSortData"
		@selection-change="onSelectionChange"
		@row-click="onRowClick"
	>
		<template #empty>
			<div
				v-if="props.loading"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:robot-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:database-refresh" />
							</template>
						</icon-with-child>
					</template>
				</el-result>
			</div>

			<div
				v-else-if="props.filtersActive"
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:robot-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-remove" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('mcpModule.clients.noFilteredResults') }}
					</template>

					<template #extra>
						<el-button
							plain
							@click="emit('reset-filters')"
						>
							{{ t('mcpModule.actions.resetFilters') }}
						</el-button>
					</template>
				</el-result>
			</div>

			<div
				v-else
				class="h-full w-full leading-normal"
			>
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:robot-outline" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('mcpModule.clients.empty') }}
					</template>
				</el-result>
			</div>
		</template>

		<el-table-column
			v-if="isMDDevice"
			type="selection"
			fixed
			:width="30"
		/>

		<el-table-column
			:width="60"
			align="center"
		>
			<template #default>
				<el-avatar :size="32">
					<icon
						icon="mdi:robot-outline"
						class="w[20px] h[20px]"
					/>
				</el-avatar>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('mcpModule.clients.columns.name')"
			prop="name"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:min-width="200"
		>
			<template #default="scope">
				<div class="font-600">{{ scope.row.name }}</div>
				<el-text
					size="small"
					truncated
				>
					{{ scope.row.description || t('mcpModule.clients.noDescription') }}
				</el-text>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('mcpModule.clients.columns.status')"
			prop="status"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="130"
		>
			<template #default="scope">
				<el-tag :type="statusType(scope.row)">
					{{ t(`mcpModule.status.${resolveMcpClientStatus(scope.row)}`) }}
				</el-tag>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('mcpModule.clients.columns.capabilities')"
			:min-width="180"
		>
			<template #default="scope">
				<div class="flex flex-wrap gap-1">
					<el-tag
						v-for="capability in scope.row.capabilities"
						:key="capability"
						type="info"
					>
						{{ t(`mcpModule.capabilities.${capability}.title`) }}
					</el-tag>
					<span v-if="scope.row.capabilities.length === 0">{{ t('mcpModule.clients.none') }}</span>
				</div>
			</template>
		</el-table-column>

		<el-table-column
			v-if="isMDDevice"
			:label="t('mcpModule.clients.columns.expires')"
			prop="expires"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="180"
		>
			<template #default="scope">
				{{ formatNullableDate(scope.row.credentialExpiresAt) }}
			</template>
		</el-table-column>

		<el-table-column
			v-if="isMDDevice"
			:label="t('mcpModule.clients.columns.lastUsed')"
			prop="lastUsed"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="180"
		>
			<template #default="scope">
				{{ formatNullableDate(scope.row.lastUsedAt) }}
			</template>
		</el-table-column>

		<el-table-column
			:width="320"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<div @click.stop>
					<mcp-client-actions
						:client="scope.row"
						@edit="emit('edit', $event)"
						@rotate="emit('rotate', $event)"
						@revoke="emit('revoke', $event)"
						@delete="emit('delete', $event)"
					/>
				</div>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAvatar, ElButton, ElResult, ElTable, ElTableColumn, ElTag, ElText, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild, useBreakpoints } from '../../../common';
import { resolveMcpClientStatus } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';

import McpClientActions from './mcp-client-actions.vue';
import type { IMcpClientsTableProps } from './mcp-clients-table.types';

defineOptions({
	name: 'McpClientsTable',
});

const props = defineProps<IMcpClientsTableProps>();

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
	(e: 'reset-filters'): void;
	(e: 'selected-changes', selected: IMcpClient[]): void;
	(e: 'update:sort-by', by: IMcpClientsTableProps['sortBy']): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t } = useI18n();

const { isMDDevice } = useBreakpoints();

const statusType = (client: IMcpClient): 'success' | 'warning' | 'danger' => {
	switch (resolveMcpClientStatus(client)) {
		case 'revoked':
		case 'expired':
			return 'danger';
		case 'disabled':
			return 'warning';
		default:
			return 'success';
	}
};

const formatNullableDate = (value: string | null): string =>
	value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('mcpModule.clients.never');

const onSortData = ({ prop, order }: { prop: IMcpClientsTableProps['sortBy']; order: 'ascending' | 'descending' | null }): void => {
	emit('update:sort-by', prop);
	emit('update:sort-dir', order === null ? null : order === 'descending' ? 'desc' : 'asc');
};

const onSelectionChange = (selected: IMcpClient[]): void => {
	emit('selected-changes', selected);
};

const onRowClick = (row: IMcpClient): void => {
	emit('edit', row);
};
</script>
