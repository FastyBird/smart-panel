<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('dashboardModule.headings.dataSources.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.dataSources.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div class="flex flex-col h-full w-full overflow-hidden">
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item name="types">
					<template #title>
						<el-text class="!px-2">
							{{ t('dashboardModule.filters.dataSources.types.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-if="typesOptions.length"
						v-model="innerFilters.types"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="type of typesOptions"
							:key="type.value"
							:label="type.label"
							:value="type.value"
						/>
					</el-checkbox-group>

					<div
						v-else
						class="px-2"
					>
						<el-alert :closable="false">
							{{ t('dashboardModule.texts.dataSources.noPlugins') }}
						</el-alert>
					</div>
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

				{{ t('dashboardModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElScrollbar, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import { type IDataSourcesFilter } from '../../composables/types';
import { useDataSourcesPlugins } from '../../composables/useDataSourcesPlugins';

import { type IListDataSourcesAdjustProps } from './list-data-sources-adjust.types';

defineOptions({
	name: 'ListDataSourcesAdjust',
});

const props = defineProps<IListDataSourcesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDataSourcesFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const { options: typesOptions } = useDataSourcesPlugins();

const activeBoxes = ref<string[]>(['types']);

const innerFilters = useVModel(props, 'filters', emit);
</script>
