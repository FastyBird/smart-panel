<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('systemModule.headings.systemLogs.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('systemModule.subHeadings.systemLogs.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="levels"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('systemModule.filters.systemLogs.levels.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-model="innerFilters.levels"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="(level, index) of levels"
							:key="index"
							:label="t(`systemModule.levels.${level}`)"
							:value="level"
						/>
					</el-checkbox-group>
				</el-collapse-item>

				<el-collapse-item
					name="sources"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('systemModule.filters.systemLogs.sources.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-model="innerFilters.sources"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="(source, index) of sources"
							:key="index"
							:label="t(`systemModule.sources.${source}`)"
							:value="source"
						/>
					</el-checkbox-group>
				</el-collapse-item>

				<el-collapse-item
					name="tag"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('systemModule.filters.systemLogs.tag.title') }}
						</el-text>
					</template>
					<el-input
						v-model="innerFilters.search"
						:placeholder="t('systemModule.filters.systemLogs.tag.placeholder')"
						class="w-full p-1"
						clearable
					>
						<template #suffix>
							<el-icon><icon icon="mdi:magnify" /></el-icon>
						</template>
					</el-input>
				</el-collapse-item>
			</el-collapse>
		</el-scrollbar>

		<div class="px-5 py-2 text-center">
			<el-button
				:disabled="!props.filtersActive"
				@click="emit('reset-filters')"
			>
				<template #icon>
					<icon icon="mdi:filter-remove" />
				</template>

				{{ t('systemModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElIcon, ElInput, ElScrollbar, ElText, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import { ConfigModuleSystemLog_levels, SystemModuleLogEntrySource } from '../../../../openapi';
import { type ISystemLogsFilter } from '../../composables/types';

import { type IListSystemLogsAdjustProps } from './list-system-logs-adjust.types';

defineOptions({
	name: 'ListSystemLogsAdjust',
});

const props = defineProps<IListSystemLogsAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: ISystemLogsFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-system-logs-adjust');
const { t } = useI18n();

const levels: ConfigModuleSystemLog_levels[] = [
	ConfigModuleSystemLog_levels.silent,
	ConfigModuleSystemLog_levels.fatal,
	ConfigModuleSystemLog_levels.error,
	ConfigModuleSystemLog_levels.warn,
	ConfigModuleSystemLog_levels.log,
	ConfigModuleSystemLog_levels.info,
	ConfigModuleSystemLog_levels.success,
	ConfigModuleSystemLog_levels.fail,
	ConfigModuleSystemLog_levels.debug,
];

const sources: string[] = Object.values(SystemModuleLogEntrySource);

const activeBoxes = ref<string[]>(['levels', 'sources', 'tag']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-system-logs-adjust.scss';
</style>
