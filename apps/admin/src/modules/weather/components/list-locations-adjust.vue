<template>
	<!-- The filters drawer of the list's filter bar: its heading and Reset are the bar's; primary is a quick filter -->
	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="types"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('weatherModule.filters.locations.types.title') }}
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
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElScrollbar, ElText, useNamespace } from 'element-plus';

import { useVModel } from '@vueuse/core';

import { type IWeatherLocationsFilter, useWeatherLocationsPlugins } from '../composables/composables';

import { type IListLocationsAdjustProps } from './list-locations-adjust.types';

defineOptions({
	name: 'ListLocationsAdjust',
});

const props = defineProps<IListLocationsAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IWeatherLocationsFilter): void;
}>();

const { t } = useI18n();

const ns = useNamespace('list-locations-adjust');

const { options: typesOptions } = useWeatherLocationsPlugins();

const activeBoxes = ref<string[]>(['types']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-locations-adjust.scss';
</style>
