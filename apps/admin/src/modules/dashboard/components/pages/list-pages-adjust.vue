<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('dashboardModule.headings.pages.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('dashboardModule.subHeadings.pages.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div class="flex flex-col h-full w-full overflow-hidden">
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item name="types">
					<template #title>
						<el-text class="!px-2">
							{{ t('dashboardModule.filters.pages.types.title') }}
						</el-text>
					</template>
					<el-checkbox-group
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

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElScrollbar, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import { type IPagesFilter } from '../../composables/types';

import { type IListPagesAdjustProps } from './list-pages-adjust.types';

defineOptions({
	name: 'ListPagesAdjust',
});

const props = defineProps<IListPagesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IPagesFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const typesOptions: { value: string; label: string }[] = [
	{
		value: 'value',
		label: 'label',
	},
];

const activeBoxes = ref<string[]>(['types']);

const innerFilters = useVModel(props, 'filters', emit);
</script>
