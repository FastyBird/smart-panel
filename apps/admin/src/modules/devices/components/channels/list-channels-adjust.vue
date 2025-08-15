<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('devicesModule.headings.channels.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.channels.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="categories"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('devicesModule.filters.channels.category.title') }}
						</el-text>
					</template>
					<div class="px-2">
						<el-select
							v-model="innerFilters.categories"
							:placeholder="t('devicesModule.filters.channels.category.placeholder')"
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
								:label="t(`devicesModule.categories.channels.${category}`)"
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

				{{ t('devicesModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCollapse, ElCollapseItem, ElOption, ElScrollbar, ElSelect, ElText, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import { DevicesModuleChannelCategory } from '../../../../openapi';
import type { IDevicesFilter } from '../../composables/types';

import { type IListChannelsAdjustProps } from './list-channels-adjust.types';

defineOptions({
	name: 'ListChannelsAdjust',
});

const props = defineProps<IListChannelsAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-channels-adjust');
const { t } = useI18n();

const categories: string[] = Object.values(DevicesModuleChannelCategory);

const activeBoxes = ref<string[]>(['categories']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-channels-adjust.scss';
</style>
