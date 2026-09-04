<template>
	<div class="flex w-full">
		<el-form
			:inline="true"
			:model="innerFilters"
			class="grow-1"
		>
			<el-form-item
				:label="t('notificationsModule.fields.filters.status.title')"
				class="p-1 m-0!"
			>
				<el-radio-group
					v-model="innerFilters.status"
					class="notifications-filter__status"
				>
					<el-radio-button
						:label="t('notificationsModule.fields.filters.status.options.all')"
						value="all"
					/>
					<el-radio-button
						:label="t('notificationsModule.fields.filters.status.options.active')"
						value="active"
					/>
					<el-radio-button
						:label="t('notificationsModule.fields.filters.status.options.dismissed')"
						value="dismissed"
					/>
					<el-radio-button
						:label="t('notificationsModule.fields.filters.status.options.resolved')"
						value="resolved"
					/>
				</el-radio-group>
			</el-form-item>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('notificationsModule.fields.filters.unread.title')"
				class="p-1 m-0!"
			>
				<el-switch
					v-model="innerFilters.unread"
					data-test-id="unread-only-notifications"
				/>
			</el-form-item>
		</el-form>

		<div class="flex items-center">
			<bulk-actions-toolbar
				:selected-count="props.selectedCount"
				:actions="props.bulkActions"
				@action="(key: string) => emit('bulk-action', key)"
			/>

			<el-button
				v-if="props.filtersActive"
				plain
				class="px-2! mt-1 mr-1"
				:aria-label="t('notificationsModule.buttons.resetFilters.title')"
				data-test-id="reset-notifications-filters"
				@click="emit('reset-filters')"
			>
				<icon icon="mdi:filter-off" />
			</el-button>

			<!-- Severity and source live in the adjust drawer, like the secondary device filters. -->
			<el-button
				plain
				class="px-2! mt-1 mr-1"
				:aria-label="t('notificationsModule.headings.notifications.adjustFilters')"
				data-test-id="adjust-notifications-filters"
				@click="emit('adjust-list')"
			>
				<icon icon="mdi:slider" />
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElForm, ElFormItem, ElRadioButton, ElRadioGroup, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { BulkActionsToolbar, type IBulkAction } from '../../../common';
import type { INotificationsFilter } from '../schemas/list.schemas';

defineOptions({
	name: 'NotificationsFilter',
});

const props = withDefaults(
	defineProps<{
		filters: INotificationsFilter;
		filtersActive: boolean;
		selectedCount?: number;
		bulkActions?: IBulkAction[];
	}>(),
	{
		selectedCount: 0,
		bulkActions: () => [],
	}
);

const emit = defineEmits<{
	(e: 'update:filters', filters: INotificationsFilter): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
	(e: 'bulk-action', key: string): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style scoped>
.notifications-filter__status :deep(.el-radio-button__inner) {
	padding-left: 1rem;
	padding-right: 1rem;
}
</style>
