<template>
	<el-form
		:inline="true"
		:model="innerFilters"
		class="notifications-filter"
	>
		<el-form-item :label="t('notificationsModule.fields.filters.status.title')">
			<el-select
				v-model="innerFilters.status"
				class="notifications-filter__status"
			>
				<el-option
					value="all"
					:label="t('notificationsModule.fields.filters.status.options.all')"
				/>
				<el-option
					value="active"
					:label="t('notificationsModule.fields.filters.status.options.active')"
				/>
				<el-option
					value="dismissed"
					:label="t('notificationsModule.fields.filters.status.options.dismissed')"
				/>
				<el-option
					value="resolved"
					:label="t('notificationsModule.fields.filters.status.options.resolved')"
				/>
			</el-select>
		</el-form-item>

		<el-form-item :label="t('notificationsModule.fields.filters.severity.title')">
			<el-select
				v-model="innerFilters.severity"
				multiple
				collapse-tags
				collapse-tags-tooltip
				clearable
				:placeholder="t('notificationsModule.fields.filters.severity.placeholder')"
				class="notifications-filter__severity"
			>
				<el-option
					v-for="severity in severityOptions"
					:key="severity"
					:value="severity"
					:label="t(`notificationsModule.severity.${severity}`)"
				/>
			</el-select>
		</el-form-item>

		<el-form-item :label="t('notificationsModule.fields.filters.source.title')">
			<el-select
				v-model="innerFilters.source"
				clearable
				filterable
				:loading="extensionsLoading"
				:placeholder="t('notificationsModule.fields.filters.source.placeholder')"
				class="notifications-filter__source"
			>
				<el-option
					v-for="source in sourceOptions"
					:key="source.value"
					:value="source.value"
					:label="source.label"
				/>
			</el-select>
		</el-form-item>

		<el-form-item :label="t('notificationsModule.fields.filters.unread.title')">
			<el-switch v-model="innerFilters.unread" />
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, ElSwitch } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { useExtensions } from '../../extensions/composables/useExtensions';
import type { INotificationsFilter } from '../schemas/list.schemas';

defineOptions({
	name: 'NotificationsFilter',
});

const props = defineProps<{
	filters: INotificationsFilter;
}>();

const emit = defineEmits<{
	(e: 'update:filters', filters: INotificationsFilter): void;
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
.notifications-filter {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-end;
}

.notifications-filter :deep(.el-form-item) {
	margin-bottom: 0.5rem;
}

.notifications-filter__status,
.notifications-filter__severity,
.notifications-filter__source {
	width: 200px;
}
</style>
