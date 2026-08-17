<template>
	<div class="flex w-full">
		<el-form
			:inline="true"
			:model="innerFilters"
			class="grow-1"
		>
			<el-input
				v-model="innerFilters.search"
				:placeholder="t('mcpModule.clients.searchPlaceholder')"
				class="max-w[280px] p-1"
				clearable
				data-test-id="search-mcp-clients"
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('mcpModule.clients.columns.status')"
				class="p-1 m-0!"
			>
				<el-radio-group
					v-model="innerFilters.status"
					data-test-id="filter-mcp-clients-status"
				>
					<el-radio-button
						:label="t('mcpModule.status.active')"
						value="active"
					/>
					<el-radio-button
						:label="t('mcpModule.status.revoked')"
						value="revoked"
					/>
					<el-radio-button
						:label="t('mcpModule.status.expired')"
						value="expired"
					/>
					<el-radio-button
						:label="t('mcpModule.clients.filterAll')"
						value="all"
					/>
				</el-radio-group>
			</el-form-item>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('mcpModule.clientForm.capabilities')"
				class="p-1 m-0!"
			>
				<el-select
					v-model="innerFilters.capabilities"
					:placeholder="t('mcpModule.clients.filterAll')"
					class="min-w[180px]"
					multiple
					collapse-tags
					clearable
					data-test-id="filter-mcp-clients-capabilities"
				>
					<el-option
						v-for="capability in capabilityOptions"
						:key="capability"
						:label="t(`mcpModule.capabilities.${capability}.title`)"
						:value="capability"
					/>
				</el-select>
			</el-form-item>
		</el-form>

		<bulk-actions-toolbar
			:selected-count="props.selectedCount"
			:actions="props.bulkActions"
			@action="(key: string) => emit('bulk-action', key)"
		/>

		<el-button
			v-if="props.filtersActive"
			plain
			class="px-2! mt-1 mr-1"
			:title="t('mcpModule.actions.resetFilters')"
			data-test-id="reset-mcp-clients-filters"
			@click="emit('reset-filters')"
		>
			<icon icon="mdi:filter-off" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElForm, ElFormItem, ElIcon, ElInput, ElOption, ElRadioButton, ElRadioGroup, ElSelect } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { BulkActionsToolbar } from '../../../common';
import type { IMcpClientsFilter } from '../composables/types';
import { McpCapability } from '../mcp.constants';

import type { IMcpClientsFilterProps } from './mcp-clients-filter.types';

defineOptions({
	name: 'McpClientsFilter',
});

const props = defineProps<IMcpClientsFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IMcpClientsFilter): void;
	(e: 'reset-filters'): void;
	(e: 'bulk-action', key: string): void;
}>();

const { t } = useI18n();

const capabilityOptions = Object.values(McpCapability);

const innerFilters = useVModel(props, 'filters', emit);

// `clearable` hands back an empty string, which would otherwise count as an
// active filter and keep the reset button on screen.
watch(
	(): string | undefined => innerFilters.value.search,
	(val: string | undefined): void => {
		if (val === '') {
			innerFilters.value.search = undefined;
		}
	}
);
</script>
