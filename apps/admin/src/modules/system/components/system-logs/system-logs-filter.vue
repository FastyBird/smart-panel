<template>
	<div class="flex w-full items-center content-center">
		<el-form
			ref="filterFormEl"
			:inline="true"
			:model="innerFilters"
			:class="[ns.b()]"
			class="grow-1"
		>
			<el-input
				v-model="innerFilters.search"
				:placeholder="t('systemModule.fields.systemLogs.search.placeholder')"
				class="max-w[280px] p-1"
				clearable
			>
				<template #suffix>
					<el-icon><icon icon="mdi:magnify" /></el-icon>
				</template>
			</el-input>
		</el-form>

		<el-switch
			v-model="innerLive"
			class="mr-6"
			:active-text="t('systemModule.buttons.liveTail.title')"
			:inactive-text="t('systemModule.buttons.paused.title')"
		/>

		<el-button
			plain
			class="px-2! mt-1 mr-1"
			@click="emit('refresh')"
		>
			<icon icon="mdi:refresh" />
		</el-button>

		<el-button
			v-if="props.filtersActive"
			plain
			class="px-2! mt-1 mr-1"
			@click="emit('reset-filters')"
		>
			<icon icon="mdi:filter-off" />
		</el-button>

		<el-button
			plain
			class="px-2! mt-1 mr-1"
			@click="emit('adjust-list')"
		>
			<icon icon="mdi:slider" />
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElIcon, ElInput, ElSwitch, type FormInstance, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import type { ISystemLogsFilter } from '../../composables/types';

import type { ISystemLogsFilterProps } from './system-logs-filter.types';

defineOptions({
	name: 'SystemLogsFilter',
});

const props = defineProps<ISystemLogsFilterProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: ISystemLogsFilter): void;
	(e: 'update:live', live: boolean): void;
	(e: 'reset-filters'): void;
	(e: 'adjust-list'): void;
	(e: 'refresh'): void;
}>();

const ns = useNamespace('system-logs-filter');
const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);

const innerLive = useVModel(props, 'live', emit);

const filterFormEl = ref<FormInstance | undefined>(undefined);

watch(
	(): string | undefined => innerFilters.value.search,
	(val: string | undefined) => {
		if (val === '') {
			innerFilters.value.search = undefined;
		}
	}
);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'system-logs-filter.scss';
</style>
