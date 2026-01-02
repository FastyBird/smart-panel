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
							>
								<div class="flex items-center gap-2">
									<icon
										:icon="SCENE_CATEGORY_ICONS[category as SceneCategory]"
										class="text-lg"
									/>
									<span>{{ t(`scenes.categories.${category}`) }}</span>
								</div>
							</el-option>
						</el-select>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="spaces"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('scenes.filters.space.title') }}
						</el-text>
					</template>
					<div class="px-2">
						<el-select
							v-model="innerFilters.primarySpaceId"
							:placeholder="t('scenes.filters.space.placeholder')"
							name="spaces"
							filterable
							clearable
						>
							<el-option
								v-for="space in spacesOptions"
								:key="space.value"
								:label="space.label"
								:value="space.value"
							>
								<div class="flex items-center gap-2">
									<icon
										:icon="space.icon"
										class="text-lg"
									/>
									<span>{{ space.label }}</span>
								</div>
							</el-option>
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
import { computed, ref } from 'vue';
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
import { useSpaces } from '../../../spaces/composables';
import { SpaceType } from '../../../spaces/spaces.constants';
import type { IScenesFilter } from '../../composables/types';
import { SCENE_CATEGORY_ICONS, SceneCategory } from '../../scenes.constants';

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

const { spaces } = useSpaces();

const spacesOptions = computed(() => {
	const options: { value: string; label: string; icon: string }[] = [
		{
			value: 'whole_home',
			label: t('scenes.fields.wholeHome'),
			icon: 'mdi:home',
		},
	];

	// Add rooms
	const rooms = spaces.value.filter((s) => s.type === SpaceType.ROOM);
	rooms.forEach((room) => {
		options.push({
			value: room.id,
			label: room.name,
			icon: 'mdi:door',
		});
	});

	return options;
});

const activeBoxes = ref<string[]>(['enabled', 'categories', 'spaces']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-scenes-adjust.scss';
</style>
