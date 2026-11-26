<template>
	<!-- Template 6: the Logs panel, the latest application log lines -->
	<el-card
		shadow="never"
		body-class="flex flex-col gap-3 p-4!"
		data-test-id="application-logs"
	>
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-card-title mr-auto">{{ t('statsModule.headings.logs') }}</span>

			<el-select
				v-model="innerFilters.levels"
				:aria-label="t('statsModule.aria.levels')"
				:placeholder="t('statsModule.fields.logs.levels.placeholder')"
				class="w-[180px]!"
				clearable
				multiple
				collapse-tags
				collapse-tags-tooltip
			>
				<el-option
					v-for="l in levels"
					:key="l"
					:label="t(`systemModule.levels.${l}`)"
					:value="l"
				/>
			</el-select>

			<el-tooltip
				:content="t('statsModule.buttons.refresh.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('statsModule.buttons.refresh.title')"
					class="ml-0!"
					data-test-id="application-logs-refresh"
					@click="emit('refresh')"
				>
					<template #icon>
						<icon icon="mdi:refresh" />
					</template>
				</el-button>
			</el-tooltip>

			<el-tooltip
				:content="t('statsModule.buttons.openLogs.title')"
				placement="top"
			>
				<el-button
					:aria-label="t('statsModule.buttons.openLogs.title')"
					class="ml-0!"
					data-test-id="application-logs-open"
					@click="emit('detail')"
				>
					<template #icon>
						<icon icon="mdi:console" />
					</template>
				</el-button>
			</el-tooltip>
		</div>

		<state-view
			v-if="props.loading && props.systemLogs.length === 0"
			kind="loading"
			icon="mdi:console"
			:title="t('statsModule.texts.loadingLogs')"
		/>

		<state-view
			v-else-if="props.filtersActive && props.systemLogs.length === 0"
			kind="empty"
			icon="mdi:filter-multiple"
			:title="t('statsModule.texts.noFilteredLogs')"
		>
			<template #action>
				<el-button
					plain
					@click="emit('reset')"
				>
					{{ t('statsModule.buttons.resetFilters.title') }}
				</el-button>
			</template>
		</state-view>

		<state-view
			v-else-if="props.systemLogs.length === 0"
			kind="empty"
			icon="mdi:console"
			:title="t('statsModule.texts.noLogs')"
		/>

		<ul
			v-else
			class="application-logs__list m-0 p-0 list-none max-h-[350px] overflow-auto rounded bg-fill-light"
		>
			<li
				v-for="(line, i) in props.systemLogs"
				:key="i"
				class="grid grid-cols-[96px_88px_1fr] gap-x-3 items-center px-3 py-1.5 text-help"
			>
				<el-tooltip
					:content="formatFull(line.ts)"
					placement="top-start"
				>
					<span class="truncate">{{ formatRelative(line.ts) }}</span>
				</el-tooltip>

				<status-tag
					:status="levelStatus(line.type)"
					:label="t(`systemModule.levels.${line.type}`)"
				/>

				<span class="truncate text-body">
					<span
						v-if="line.tag"
						class="text-secondary"
					>
						[{{ line.tag }}]
					</span>
					{{ line.message }}
				</span>
			</li>
		</ul>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElOption, ElSelect, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo, useVModel } from '@vueuse/core';

import { StateView, StatusTag, type StatusTagStatus } from '../../../common';
import { SystemModuleLogEntryType } from '../../../openapi.constants';

import type { IApplicationLogsProps } from './application-logs.types';

defineOptions({
	name: 'ApplicationLogs',
});

const props = withDefaults(defineProps<IApplicationLogsProps>(), {
	loading: false,
});

const emit = defineEmits<{
	(e: 'refresh'): void;
	(e: 'reset'): void;
	(e: 'detail'): void;
}>();

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

const levels = [
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

const formatRelative = (iso: string): string => {
	return formatTimeAgo(new Date(iso));
};

const formatFull = (iso: string): string => {
	return new Date(iso).toISOString();
};

// The level as a status tag: failures in the danger colour, warnings in the warning colour, the rest neutral
const levelStatus = (lvl: SystemModuleLogEntryType): StatusTagStatus => {
	if ([SystemModuleLogEntryType.fatal, SystemModuleLogEntryType.error, SystemModuleLogEntryType.fail].includes(lvl)) {
		return 'danger';
	}

	if (lvl === SystemModuleLogEntryType.warn) {
		return 'warn';
	}

	if (lvl === SystemModuleLogEntryType.success) {
		return 'ok';
	}

	return 'info';
};
</script>
