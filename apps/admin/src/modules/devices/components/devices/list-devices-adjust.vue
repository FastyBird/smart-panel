<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('devicesModule.headings.devices.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('devicesModule.subHeadings.devices.adjustFilters') }}
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
							{{ t('devicesModule.filters.devices.types.title') }}
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
					name="states"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('devicesModule.filters.devices.states.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-model="innerFilters.states"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="(state, index) of states"
							:key="index"
							:label="t(`devicesModule.states.${state}`)"
							:value="state"
						/>
					</el-checkbox-group>
				</el-collapse-item>

				<el-collapse-item
					name="enabled"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('devicesModule.filters.devices.enabled.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.enabled">
							<el-radio-button
								:label="t('devicesModule.filters.devices.enabled.values.enabled')"
								value="enabled"
							/>
							<el-radio-button
								:label="t('devicesModule.filters.devices.enabled.values.disabled')"
								value="disabled"
							/>
							<el-radio-button
								:label="t('devicesModule.filters.devices.enabled.values.all')"
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
							{{ t('devicesModule.filters.devices.category.title') }}
						</el-text>
					</template>
					<div class="px-2">
						<el-select
							v-model="innerFilters.categories"
							:placeholder="t('devicesModule.filters.devices.category.placeholder')"
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
								:label="t(`devicesModule.categories.devices.${category}`)"
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

import {
	ElButton,
	ElCheckbox,
	ElCheckboxGroup,
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
import { DevicesModuleDeviceCategory, DevicesModuleDeviceStatusStatus } from '../../../../openapi.constants';
import { type IDevicesFilter, useDevicesPlugins } from '../../composables/composables';

import { type IListDevicesAdjustProps } from './list-devices-adjust.types';

defineOptions({
	name: 'ListDevicesAdjust',
});

const props = defineProps<IListDevicesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-devices-adjust');
const { t } = useI18n();

const { options: typesOptions } = useDevicesPlugins();

const states: DevicesModuleDeviceStatusStatus[] = [
	DevicesModuleDeviceStatusStatus.connected,
	DevicesModuleDeviceStatusStatus.disconnected,
	DevicesModuleDeviceStatusStatus.init,
	DevicesModuleDeviceStatusStatus.ready,
	DevicesModuleDeviceStatusStatus.running,
	DevicesModuleDeviceStatusStatus.sleeping,
	DevicesModuleDeviceStatusStatus.stopped,
	DevicesModuleDeviceStatusStatus.lost,
	DevicesModuleDeviceStatusStatus.alert,
	DevicesModuleDeviceStatusStatus.unknown,
];

const categories: string[] = Object.values(DevicesModuleDeviceCategory);

const activeBoxes = ref<string[]>(['types', 'states', 'enabled', 'categories']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-devices-adjust.scss';
</style>
