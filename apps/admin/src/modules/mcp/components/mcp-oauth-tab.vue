<template>
	<!-- Template 1 inside a tab: one card with the filter bar and the table (rows on phone) -->
	<el-card
		shadow="never"
		class="flex flex-col"
		body-class="p-0! flex flex-col"
		:data-test-id="props.testId"
	>
		<list-filter-bar
			v-model:search="search"
			:search-placeholder="t('mcpModule.oauthManagement.searchPlaceholder')"
			:quick-filters="quickFilters"
			:active-count="innerFilters.status !== 'all' ? 1 : 0"
			@quick-filter="onQuickFilter"
			@reset="emit('reset-filters')"
		/>

		<slot />
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { ListFilterBar, type ListFilterBarQuickFilter } from '../../../common';
import type { IMcpOAuthTabFilter } from '../composables/useMcpOAuthTabQuery';

defineOptions({ name: 'McpOAuthTab' });

const props = defineProps<{
	filters: IMcpOAuthTabFilter;
	/** Status values with their label keys; empty for a tab without a status (refresh families), which then filters on
	 * search alone */
	statusOptions: { value: string; label: string }[];
	testId: string;
}>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IMcpOAuthTabFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

const search = computed<string>({
	get: (): string => innerFilters.value.search ?? '',
	set: (value: string): void => {
		innerFilters.value.search = value === '' ? undefined : value;
	},
});

const quickFilters = computed<ListFilterBarQuickFilter[]>((): ListFilterBarQuickFilter[] =>
	props.statusOptions.length === 0
		? []
		: [
				{
					id: 'status',
					label: t('mcpModule.oauthManagement.columns.status'),
					options: props.statusOptions.map((option) => ({ value: option.value, label: t(option.label) })),
					value: innerFilters.value.status === 'all' ? null : innerFilters.value.status,
				},
			]
);

const onQuickFilter = (id: string, value: string | null): void => {
	if (id === 'status') {
		innerFilters.value.status = value ?? 'all';
	}
};
</script>
