<template>
	<el-table
		ref="tableEl"
		v-loading="props.loading && props.items.length > 0"
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
			<mcp-clients-empty
				:loading="props.loading"
				:load-failed="props.loadFailed"
				:filters-active="props.filtersActive"
				@reset-filters="emit('reset-filters')"
				@retry="emit('retry')"
			/>
		</template>

		<el-table-column
			type="selection"
			fixed="left"
			:width="40"
		/>

		<el-table-column
			:width="56"
			align="center"
		>
			<template #default>
				<span
					class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-fill-light text-regular"
					aria-hidden="true"
				>
					<icon
						:icon="MCP_CLIENT_ICON"
						width="20"
						height="20"
					/>
				</span>
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
				<span class="block text-card-title truncate">{{ scope.row.name }}</span>
				<span class="block text-help truncate">
					{{ scope.row.description || t('mcpModule.clients.noDescription') }}
				</span>
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
				<status-tag
					:status="MCP_CLIENT_STATUS_TAGS[resolveMcpClientStatus(scope.row)]"
					:label="t(`mcpModule.status.${resolveMcpClientStatus(scope.row)}`)"
					data-test-id="mcp-client-status"
				/>
			</template>
		</el-table-column>

		<el-table-column
			:label="t('mcpModule.clients.columns.capabilities')"
			:min-width="160"
		>
			<template #default="scope">
				<span class="text-body">{{ capabilitiesLabel(scope.row) }}</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('mcpModule.clients.columns.expires')"
			prop="expires"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="180"
		>
			<template #default="scope">
				<span class="text-body">{{ formatNullableDate(scope.row.credentialExpiresAt) }}</span>
			</template>
		</el-table-column>

		<el-table-column
			v-if="!isTabletPortrait"
			:label="t('mcpModule.clients.columns.lastUsed')"
			prop="lastUsed"
			sortable="custom"
			:sort-orders="['ascending', 'descending']"
			:width="180"
		>
			<template #default="scope">
				<span class="text-body">{{ formatNullableDate(scope.row.lastUsedAt) }}</span>
			</template>
		</el-table-column>

		<el-table-column
			:width="96"
			align="right"
			fixed="right"
		>
			<template #default="scope">
				<mcp-client-actions
					:client="scope.row"
					@edit="emit('edit', $event)"
					@rotate="emit('rotate', $event)"
					@revoke="emit('revoke', $event)"
					@delete="emit('delete', $event)"
				/>
			</template>
		</el-table-column>
	</el-table>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTable, ElTableColumn, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { StatusTag, useSizeClass } from '../../../common';
import { MCP_CLIENT_ICON } from '../mcp.constants';
import { MCP_CLIENT_STATUS_TAGS, resolveMcpClientStatus } from '../mcp.utils';
import type { IMcpClient } from '../schemas/client.types';

import McpClientActions from './mcp-client-actions.vue';
import McpClientsEmpty from './mcp-clients-empty.vue';
import type { IMcpClientsTableProps } from './mcp-clients-table.types';

defineOptions({
	name: 'McpClientsTable',
});

const props = withDefaults(defineProps<IMcpClientsTableProps>(), {
	loadFailed: false,
	tableHeight: undefined,
});

const emit = defineEmits<{
	(e: 'edit', client: IMcpClient): void;
	(e: 'rotate', client: IMcpClient): void;
	(e: 'revoke', client: IMcpClient): void;
	(e: 'delete', client: IMcpClient): void;
	(e: 'reset-filters'): void;
	(e: 'retry'): void;
	(e: 'selected-changes', selected: IMcpClient[]): void;
	(e: 'update:sort-by', by: IMcpClientsTableProps['sortBy']): void;
	(e: 'update:sort-dir', dir: 'asc' | 'desc' | null): void;
}>();

const { t, locale } = useI18n();

const { isTabletPortrait } = useSizeClass();

const tableEl = ref<InstanceType<typeof ElTable> | null>(null);

const capabilitiesLabel = (client: IMcpClient): string =>
	client.capabilities.length === 0
		? t('mcpModule.clients.none')
		: client.capabilities.map((capability) => t(`mcpModule.capabilities.${capability}.title`)).join(', ');

// In the language of the application
const formatNullableDate = (value: string | null): string =>
	value ? new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : t('mcpModule.clients.never');

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

// The filter bar's Clear selection
const clearSelection = (): void => {
	tableEl.value?.clearSelection();
};

defineExpose({ clearSelection });
</script>
