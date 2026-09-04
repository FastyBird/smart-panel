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
				:label="t('notificationsModule.fields.filters.severity.title')"
				class="p-1 m-0!"
			>
				<el-select
					v-model="innerFilters.severity"
					multiple
					collapse-tags
					collapse-tags-tooltip
					clearable
					:placeholder="t('notificationsModule.fields.filters.severity.placeholder')"
					class="w-[200px]!"
				>
					<el-option
						v-for="severity in severityOptions"
						:key="severity"
						:value="severity"
						:label="t(`notificationsModule.severity.${severity}`)"
					/>
				</el-select>
			</el-form-item>

			<el-divider direction="vertical" />

			<el-form-item
				:label="t('notificationsModule.fields.filters.source.title')"
				class="p-1 m-0!"
			>
				<el-select
					v-model="innerFilters.source"
					clearable
					filterable
					:loading="extensionsLoading"
					:placeholder="t('notificationsModule.fields.filters.source.placeholder')"
					class="w-[220px]!"
				>
					<el-option
						v-for="source in sourceOptions"
						:key="source.value"
						:value="source.value"
						:label="source.label"
					/>
				</el-select>
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
				data-test-id="reset-notifications-filters"
				@click="emit('reset-filters')"
			>
				<icon icon="mdi:filter-off" />
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElForm, ElFormItem, ElOption, ElRadioButton, ElRadioGroup, ElSelect, ElSwitch } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { BulkActionsToolbar, type IBulkAction } from '../../../common';
import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { useExtensions } from '../../extensions/composables/useExtensions';
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
	(e: 'bulk-action', key: string): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

const severityOptions = Object.values(NotificationsModuleNotificationSeverity);

// The closed set of possible sources - every extension type the backend knows about, not merely
// the sources present in whatever page of notifications happens to be loaded right now.
const { extensions, areLoading: extensionsLoading, fetchExtensions } = useExtensions();

const sourceOptions = computed<{ value: string; label: string }[]>((): { value: string; label: string }[] =>
	extensions.value.map((extension) => ({ value: extension.type, label: extension.name }))
);

onBeforeMount((): void => {
	void fetchExtensions();
});
</script>

<style scoped>
.notifications-filter__status :deep(.el-radio-button__inner) {
	padding-left: 1rem;
	padding-right: 1rem;
}
</style>
