<template>
	<!-- Phone (template 1): rows instead of the table, with the same row actions -->
	<mcp-table-empty
		v-if="props.rows.length === 0"
		:icon="props.icon"
		:loading="props.loading"
		:failed="props.failed"
		:filters-active="props.filtersActive"
		:empty-label="props.emptyLabel"
		@retry="emit('retry')"
		@reset-filters="emit('reset-filters')"
	/>

	<ul
		v-else
		class="m-0 p-0 list-none"
		data-test-id="mcp-oauth-row-list"
	>
		<li
			v-for="(row, index) in props.rows"
			:key="row.id"
			class="flex items-center gap-2 min-h-14 px-3 py-2 border-t border-t-solid border-light"
		>
			<span class="flex flex-col flex-1 min-w-0">
				<span class="text-card-title truncate">{{ row.title }}</span>
				<!-- Wraps rather than truncates: the scopes and the expiry are what a revoke is decided on, and a phone
				     row has no other place to show them -->
				<span
					class="text-help break-words"
					data-test-id="mcp-oauth-row-caption"
				>
					{{ row.caption }}
				</span>
			</span>
			<status-tag
				v-if="row.status"
				:status="row.status.status"
				:label="row.status.label"
			/>
			<slot
				name="actions"
				:index="index"
			/>
		</li>
	</ul>
</template>

<script setup lang="ts">
import { StatusTag } from '../../../common';

import type { McpOAuthRow } from './mcp-oauth-row-list.types';
import McpTableEmpty from './mcp-table-empty.vue';

defineOptions({ name: 'McpOAuthRowList' });

const props = withDefaults(
	defineProps<{
		rows: McpOAuthRow[];
		icon: string;
		loading: boolean;
		failed?: boolean;
		filtersActive?: boolean;
		emptyLabel: string;
	}>(),
	{
		failed: false,
		filtersActive: false,
	}
);

const emit = defineEmits<{
	(e: 'retry'): void;
	(e: 'reset-filters'): void;
}>();
</script>
