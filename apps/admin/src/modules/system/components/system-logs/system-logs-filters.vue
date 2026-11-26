<template>
	<!-- The logs' filters, in the filter bar's drawer: levels, sources and the tag -->
	<div class="flex flex-col gap-4">
		<fieldset class="flex flex-col gap-1 m-0 p-0 border-0">
			<legend class="text-label mb-1 p-0">{{ t('systemModule.filters.systemLogs.levels.title') }}</legend>
			<el-checkbox-group
				v-model="innerFilters.levels"
				class="grid grid-cols-2 gap-x-4"
				data-test-id="system-logs-filters-levels"
			>
				<el-checkbox
					v-for="level in LEVELS"
					:key="level"
					:label="t(`systemModule.levels.${level}`)"
					:value="level"
				/>
			</el-checkbox-group>
		</fieldset>

		<fieldset class="flex flex-col gap-1 m-0 p-0 border-0">
			<legend class="text-label mb-1 p-0">{{ t('systemModule.filters.systemLogs.sources.title') }}</legend>
			<el-checkbox-group
				v-model="innerFilters.sources"
				class="flex flex-col"
				data-test-id="system-logs-filters-sources"
			>
				<el-checkbox
					v-for="source in SOURCES"
					:key="source"
					:label="t(`systemModule.sources.${source}`)"
					:value="source"
				/>
			</el-checkbox-group>
		</fieldset>

		<div class="flex flex-col gap-1">
			<label
				for="system-logs-filters-tag"
				class="text-label"
			>
				{{ t('systemModule.filters.systemLogs.tag.title') }}
			</label>
			<el-input
				id="system-logs-filters-tag"
				:model-value="innerFilters.tag ?? ''"
				:placeholder="t('systemModule.filters.systemLogs.tag.placeholder')"
				clearable
				data-test-id="system-logs-filters-tag"
				@update:model-value="(value: string) => (innerFilters.tag = value === '' ? undefined : value)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElCheckboxGroup, ElInput } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { SystemModuleLogEntrySource, SystemModuleLogEntryType } from '../../../../openapi.constants';
import type { ISystemLogsFilter } from '../../composables/types';

import type { ISystemLogsFiltersProps } from './system-logs-filters.types';

defineOptions({
	name: 'SystemLogsFilters',
});

const props = defineProps<ISystemLogsFiltersProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: ISystemLogsFilter): void;
}>();

const { t } = useI18n();

const LEVELS: SystemModuleLogEntryType[] = [
	SystemModuleLogEntryType.silent,
	SystemModuleLogEntryType.fatal,
	SystemModuleLogEntryType.error,
	SystemModuleLogEntryType.warn,
	SystemModuleLogEntryType.log,
	SystemModuleLogEntryType.info,
	SystemModuleLogEntryType.success,
	SystemModuleLogEntryType.fail,
	SystemModuleLogEntryType.debug,
];

const SOURCES: SystemModuleLogEntrySource[] = Object.values(SystemModuleLogEntrySource);

const innerFilters = useVModel(props, 'filters', emit);
</script>
