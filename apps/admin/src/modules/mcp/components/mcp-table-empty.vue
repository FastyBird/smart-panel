<template>
	<!-- A failed load outranks an active filter: filters are often set when a request fails, and reporting "no matches"
	     would send the user adjusting a filter that is not the cause -->
	<state-view
		v-if="props.loading"
		kind="loading"
		:icon="props.icon"
	/>

	<state-view
		v-else-if="props.failed"
		kind="error"
		:title="t('mcpModule.messages.loadFailed')"
		:icon="props.icon"
	>
		<template #action>
			<el-button
				plain
				data-test-id="mcp-table-retry"
				@click="emit('retry')"
			>
				{{ t('mcpModule.actions.retry') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		:title="t('mcpModule.clients.noFilteredResults')"
		icon="mdi:filter-multiple"
	>
		<template #action>
			<el-button
				plain
				data-test-id="mcp-table-reset-filters"
				@click="emit('reset-filters')"
			>
				{{ t('mcpModule.actions.resetFilters') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		:title="t(props.emptyLabel)"
		:icon="props.icon"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';

import type { IMcpTableEmptyProps } from './mcp-table-empty.types';

defineOptions({
	name: 'McpTableEmpty',
});

const props = withDefaults(defineProps<IMcpTableEmptyProps>(), {
	failed: false,
	filtersActive: false,
});

const emit = defineEmits<{
	(e: 'retry'): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
