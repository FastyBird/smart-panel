<template>
	<div class="h-full w-full leading-normal">
		<el-result class="h-full w-full">
			<template #icon>
				<icon-with-child :size="80">
					<template #primary>
						<icon :icon="props.icon" />
					</template>
					<template #secondary>
						<icon :icon="secondaryIcon" />
					</template>
				</icon-with-child>
			</template>

			<template
				v-if="!props.loading"
				#title
			>
				<el-text class="block">
					{{ title }}
				</el-text>
			</template>

			<template
				v-if="!props.loading && (props.failed || props.filtersActive)"
				#extra
			>
				<el-button
					v-if="props.failed"
					type="primary"
					plain
					data-test-id="mcp-table-retry"
					@click="emit('retry')"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>

					{{ t('mcpModule.actions.retry') }}
				</el-button>

				<el-button
					v-else
					type="primary"
					plain
					data-test-id="mcp-table-reset-filters"
					@click="emit('reset-filters')"
				>
					<template #icon>
						<icon icon="mdi:filter-off" />
					</template>

					{{ t('mcpModule.actions.resetFilters') }}
				</el-button>
			</template>
		</el-result>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElResult, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { IconWithChild } from '../../../common';

import type { IMcpTableEmptyProps } from './mcp-table-empty.types';

defineOptions({
	name: 'McpTableEmpty',
});

const props = defineProps<IMcpTableEmptyProps>();

const emit = defineEmits<{
	(e: 'retry'): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

// A failed load outranks an active filter: filters are often set when a request
// fails, and reporting "no matches" would send the user adjusting a filter that
// is not the cause.
const secondaryIcon = computed<string>((): string => {
	if (props.loading) {
		return 'mdi:database-refresh';
	}

	if (props.failed) {
		return 'mdi:alert-circle';
	}

	return props.filtersActive ? 'mdi:filter-multiple' : 'mdi:information';
});

const title = computed<string>((): string => {
	if (props.failed) {
		return t('mcpModule.messages.loadFailed');
	}

	return props.filtersActive ? t('mcpModule.clients.noFilteredResults') : t(props.emptyLabel);
});
</script>
