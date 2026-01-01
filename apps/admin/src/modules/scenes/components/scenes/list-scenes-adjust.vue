<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('scenes.headings.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('scenes.subHeadings.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="enabled"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('scenes.filters.enabled.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.enabled">
							<el-radio-button
								:label="t('scenes.filters.enabled.values.enabled')"
								value="enabled"
							/>
							<el-radio-button
								:label="t('scenes.filters.enabled.values.disabled')"
								value="disabled"
							/>
							<el-radio-button
								:label="t('scenes.filters.enabled.values.all')"
								value="all"
							/>
						</el-radio-group>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="categories"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('scenes.filters.category.title') }}
						</el-text>
					</template>
					<div class="px-2">
						<el-select
							v-model="innerFilters.categories"
							:placeholder="t('scenes.filters.category.placeholder')"
							name="categories"
							filterable
							multiple
							clearable
							collapse-tags
							collapse-tags-tooltip
							:max-collapse-tags="3"
						>
							<el-option
								v-for="(category, index) in categories"
								:key="index"
								:label="t(`scenes.categories.${category}`)"
								:value="category"
							/>
						</el-select>
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

				{{ t('scenes.buttons.resetFilters.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElButton,
	ElCollapse,
	ElCollapseItem,
	ElOption,
	ElRadioButton,
	ElRadioGroup,
	ElScrollbar,
	ElSelect,
	ElText,
	useNamespace,
} from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import type { IScenesFilter } from '../../composables/types';
import { SceneCategory } from '../../scenes.constants';

import type { IListScenesAdjustProps } from './list-scenes-adjust.types';

defineOptions({
	name: 'ListScenesAdjust',
});

const props = defineProps<IListScenesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IScenesFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-scenes-adjust');
const { t } = useI18n();

const categories: string[] = Object.values(SceneCategory);

const activeBoxes = ref<string[]>(['enabled', 'categories']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-scenes-adjust.scss';
</style>
