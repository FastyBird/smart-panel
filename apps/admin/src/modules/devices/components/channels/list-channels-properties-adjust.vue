<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('devicesModule.headings.channelsProperties.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.channelsProperties.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div class="flex flex-col h-full w-full overflow-hidden">
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item name="categories">
					<template #title>
						<el-text class="!px-2">
							{{ t('devicesModule.filters.channelsProperties.category.title') }}
						</el-text>
					</template>
					<div class="px-2">
						<el-select
							v-model="innerFilters.categories"
							:placeholder="t('devicesModule.filters.channelsProperties.category.placeholder')"
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
								:label="t(`devicesModule.categories.channelsProperties.${category}`)"
								:value="category"
							/>
						</el-select>
					</div>
				</el-collapse-item>

				<el-collapse-item name="dataTypes">
					<template #title>
						<el-text class="!px-2">
							{{ t('devicesModule.filters.channelsProperties.dataType.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-model="innerFilters.dataTypes"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="(dataType, index) of dataTypes"
							:key="index"
							:label="t(`devicesModule.dataTypes.${dataType}`)"
							:value="dataType"
						/>
					</el-checkbox-group>
				</el-collapse-item>

				<el-collapse-item name="permissions">
					<template #title>
						<el-text class="!px-2">
							{{ t('devicesModule.filters.channelsProperties.permission.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-model="innerFilters.permissions"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="(permission, index) of permissions"
							:key="index"
							:label="t(`devicesModule.permissions.${permission}`)"
							:value="permission"
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

				{{ t('devicesModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElOption, ElScrollbar, ElSelect, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import {
	DevicesModuleChannelPropertyCategory,
	DevicesModuleChannelPropertyData_type,
	DevicesModuleChannelPropertyPermissions,
} from '../../../../openapi';
import type { IDevicesFilter } from '../../composables/composables';

import { type IListChannelsPropertiesAdjustProps } from './list-channels-properties-adjust.types';

defineOptions({
	name: 'ListChannelsPropertiesAdjust',
});

const props = defineProps<IListChannelsPropertiesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const categories: string[] = Object.values(DevicesModuleChannelPropertyCategory);

const dataTypes: string[] = Object.values(DevicesModuleChannelPropertyData_type);

const permissions: string[] = Object.values(DevicesModuleChannelPropertyPermissions);

const activeBoxes = ref<string[]>(['categories', 'dataTypes', 'permissions']);

const innerFilters = useVModel(props, 'filters', emit);
</script>
