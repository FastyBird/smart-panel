<template>
	<!-- The empty states of the client list, for the table and the phone rows alike. A failed load outranks an active
	     filter: reporting "no matches" would send the user adjusting a filter that is not the cause -->
	<state-view
		v-if="props.loading"
		kind="loading"
		:title="t('mcpModule.clients.loading')"
		:icon="MCP_CLIENT_ICON"
	/>

	<state-view
		v-else-if="props.loadFailed"
		kind="error"
		:title="t('mcpModule.messages.loadFailed')"
		:icon="MCP_CLIENT_ICON"
	>
		<template #action>
			<el-button
				plain
				data-test-id="mcp-clients-retry"
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
				data-test-id="mcp-clients-reset-filters"
				@click="emit('reset-filters')"
			>
				{{ t('mcpModule.actions.resetFilters') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		:title="t('mcpModule.clients.empty')"
		:icon="MCP_CLIENT_ICON"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';
import { MCP_CLIENT_ICON } from '../mcp.constants';

defineOptions({
	name: 'McpClientsEmpty',
});

const props = withDefaults(defineProps<{ loading: boolean; loadFailed?: boolean; filtersActive: boolean }>(), {
	loadFailed: false,
});

const emit = defineEmits<{
	(e: 'retry'): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
