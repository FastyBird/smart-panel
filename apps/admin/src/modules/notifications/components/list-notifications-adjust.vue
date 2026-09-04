<template>
	<div class="list-notifications-adjust flex flex-col h-full w-full overflow-hidden">
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="severity"
					class="list-notifications-adjust__filter-item"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('notificationsModule.filters.notifications.severity.title') }}
						</el-text>
					</template>

					<el-checkbox-group
						v-model="innerFilters.severity"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="severity of severityOptions"
							:key="severity"
							:label="t(`notificationsModule.severity.${severity}`)"
							:value="severity"
						/>
					</el-checkbox-group>
				</el-collapse-item>

				<el-collapse-item
					name="source"
					class="list-notifications-adjust__filter-item"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('notificationsModule.filters.notifications.source.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-select
							v-model="innerFilters.source"
							:placeholder="t('notificationsModule.fields.filters.source.placeholder')"
							:loading="extensionsLoading"
							name="source"
							filterable
							clearable
						>
							<el-option
								v-for="source in sourceOptions"
								:key="source.value"
								:value="source.value"
								:label="source.label"
							/>
						</el-select>
					</div>
				</el-collapse-item>
			</el-collapse>
		</el-scrollbar>

		<div class="px-5 py-2 text-center">
			<el-button
				:disabled="!props.filtersActive"
				data-test-id="reset-notifications-filters-adjust"
				@click="emit('reset-filters')"
			>
				<template #icon>
					<icon icon="mdi:filter-remove" />
				</template>

				{{ t('notificationsModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElOption, ElScrollbar, ElSelect, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { useExtensions } from '../../extensions/composables/useExtensions';
import type { INotificationsFilter } from '../schemas/list.schemas';

defineOptions({
	name: 'ListNotificationsAdjust',
});

const props = defineProps<{
	filters: INotificationsFilter;
	filtersActive: boolean;
}>();

const emit = defineEmits<{
	(e: 'update:filters', filters: INotificationsFilter): void;
	(e: 'reset-filters'): void;
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

const activeBoxes = ref<string[]>(['severity', 'source']);

onBeforeMount((): void => {
	void fetchExtensions();
});
</script>

<style scoped>
.list-notifications-adjust__filter-item :deep(.el-collapse-item__header) {
	width: auto;
}
</style>
