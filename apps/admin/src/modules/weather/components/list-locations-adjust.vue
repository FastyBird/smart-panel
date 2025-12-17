<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('weatherModule.headings.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('weatherModule.subHeadings.adjustFilters') }}
		</template>
	</app-bar-heading>

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

				<el-collapse-item
					name="primary"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('weatherModule.filters.locations.primary.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.primary">
							<el-radio-button
								:label="t('weatherModule.filters.locations.primary.values.primary')"
								value="primary"
							/>
							<el-radio-button
								:label="t('weatherModule.filters.locations.primary.values.secondary')"
								value="secondary"
							/>
							<el-radio-button
								:label="t('weatherModule.filters.locations.primary.values.all')"
								value="all"
							/>
						</el-radio-group>
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

				{{ t('weatherModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElButton,
	ElCheckbox,
	ElCheckboxGroup,
	ElCollapse,
	ElCollapseItem,
	ElRadioButton,
	ElRadioGroup,
	ElScrollbar,
	ElText,
	useNamespace,
} from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../common';
import { type IWeatherLocationsFilter, useWeatherLocationsPlugins } from '../composables/composables';

import { type IListLocationsAdjustProps } from './list-locations-adjust.types';

defineOptions({
	name: 'ListLocationsAdjust',
});

const props = defineProps<IListLocationsAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IWeatherLocationsFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const ns = useNamespace('list-locations-adjust');

const { options: typesOptions } = useWeatherLocationsPlugins();

const activeBoxes = ref<string[]>(['types', 'primary']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-locations-adjust.scss';
</style>
