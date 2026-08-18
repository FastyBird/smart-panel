<template>
	<div class="flex w-full items-center gap-2 px-1 py-2">
		<el-input
			v-model="innerFilters.search"
			:placeholder="props.searchPlaceholder"
			class="max-w[280px]"
			clearable
			:data-test-id="`search-${props.testId}`"
		>
			<template #suffix>
				<el-icon><icon icon="mdi:magnify" /></el-icon>
			</template>
		</el-input>

		<el-select
			v-if="props.statusOptions.length > 0"
			v-model="innerFilters.status"
			class="max-w[200px]"
			:data-test-id="`filter-${props.testId}-status`"
		>
			<el-option
				:label="t('mcpModule.clients.filterAll')"
				value="all"
			/>
			<el-option
				v-for="option in props.statusOptions"
				:key="option.value"
				:label="t(option.label)"
				:value="option.value"
			/>
		</el-select>

		<div class="grow-1" />

		<el-button
			v-if="props.filtersActive"
			plain
			class="px-2!"
			:title="t('mcpModule.actions.resetFilters')"
			:data-test-id="`reset-${props.testId}-filters`"
			@click="emit('reset-filters')"
		>
			<icon icon="mdi:filter-off" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElIcon, ElInput, ElOption, ElSelect } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import type { IMcpOAuthTabFilter } from '../composables/useMcpOAuthTabQuery';

import type { IMcpOAuthTabFilterProps } from './mcp-oauth-tab-filter.types';

defineOptions({
	name: 'McpOAuthTabFilter',
});

const props = defineProps<IMcpOAuthTabFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IMcpOAuthTabFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

// `clearable` yields an empty string, which would otherwise read as an active
// filter and keep the reset button on screen.
watch(
	(): string | undefined => innerFilters.value.search,
	(val: string | undefined): void => {
		if (val === '') {
			innerFilters.value.search = undefined;
		}
	}
);
</script>
