<template>
	<el-card
		shadow="never"
		header-class="px-3! py-3! font-bold"
		body-class="p-0!"
	>
		<template #header>
			<div class="flex flex-row items-center justify-between">
				{{ t('statsModule.headings.logs') }}

				<div>
					<el-select
						v-model="innerFilters.levels"
						size="small"
						class="mr-1 w-[180px]!"
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

					<el-button
						size="small"
						class="px-2! ml-1!"
						@click="emit('refresh')"
					>
						<template #icon>
							<icon icon="mdi:refresh" />
						</template>
					</el-button>

					<el-button
						size="small"
						class="px-2! ml-1!"
						@click="emit('detail')"
					>
						<template #icon>
							<icon icon="mdi:console" />
						</template>
					</el-button>
				</div>
			</div>
		</template>

		<div v-loading="loading">
			<div v-if="filtersActive && systemLogs.length === 0 && !props.loading">
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:console" />
							</template>
							<template #secondary>
								<icon icon="mdi:filter-multiple" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						<el-text class="block">
							{{ t('statsModule.texts.noFilteredLogs') }}
						</el-text>

						<el-button
							type="primary"
							plain
							class="mt-4"
							@click="emit('reset')"
						>
							<template #icon>
								<icon icon="mdi:filter-off" />
							</template>

							{{ t('statsModule.buttons.resetFilters.title') }}
						</el-button>
					</template>
				</el-result>
			</div>

			<div v-else-if="systemLogs.length === 0 && !props.loading">
				<el-result class="h-full w-full">
					<template #icon>
						<icon-with-child :size="80">
							<template #primary>
								<icon icon="mdi:console" />
							</template>
							<template #secondary>
								<icon icon="mdi:information" />
							</template>
						</icon-with-child>
					</template>

					<template #title>
						{{ t('statsModule.texts.noLogs') }}
					</template>
				</el-result>
			</div>

			<div
				v-else
				class="max-h-[350px] overflow-auto bg-[var(--el-fill-color-light)]"
			>
				<div
					v-for="(line, i) in systemLogs"
					:key="i"
					class="grid grid-cols-[110px_60px_1fr] gap-x-4 text-xs b-b b-b-solid last:b-b-none mb-1 last:mb-0 px-2 py-1 items-center"
				>
					<el-tooltip
						:content="formatFull(line.ts)"
						placement="top-start"
					>
						{{ formatRelative(line.ts) }}
					</el-tooltip>

					<el-tag
						v-bind="levelTagProps(line.type)"
						size="small"
					>
						{{ line.type }}
					</el-tag>

					<div>{{ line.message }}</div>
				</div>
			</div>
		</div>
	</el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElCard, ElOption, ElResult, ElSelect, ElTag, ElText, ElTooltip, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';
import { formatTimeAgo, useVModel } from '@vueuse/core';

import { IconWithChild } from '../../../common';
import { ConfigModuleSystemLog_levels } from '../../../openapi';

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

const formatRelative = (iso: string): string => {
	return formatTimeAgo(new Date(iso));
};

const formatFull = (iso: string): string => {
	return new Date(iso).toISOString();
};

const levelTagProps = (lvl: ConfigModuleSystemLog_levels) => {
	if ([ConfigModuleSystemLog_levels.fatal, ConfigModuleSystemLog_levels.error, ConfigModuleSystemLog_levels.fail].includes(lvl)) {
		return { type: 'danger' as const, effect: 'light' as const };
	}

	if ([ConfigModuleSystemLog_levels.warn].includes(lvl)) {
		return { type: 'warning' as const, effect: 'light' as const };
	}

	if ([ConfigModuleSystemLog_levels.success, ConfigModuleSystemLog_levels.info, ConfigModuleSystemLog_levels.log].includes(lvl)) {
		return { type: 'success' as const, effect: 'light' as const };
	}

	return {
		effect: 'plain' as const,
		class: 'tag-neutral',
	};
};
</script>
