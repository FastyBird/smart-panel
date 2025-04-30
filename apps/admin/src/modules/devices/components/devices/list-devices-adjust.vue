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

	<div class="flex flex-col h-full w-full overflow-hidden">
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item name="types">
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

				<el-collapse-item name="states">
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

				<el-collapse-item name="categories">
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

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElOption, ElScrollbar, ElSelect, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../../common';
import { DevicesModuleDeviceCategory } from '../../../../openapi';
import { type IDevicesFilter, useDevicesPlugins } from '../../composables/composables';
import { ConnectionState } from '../../devices.constants';

import { type IListDevicesAdjustProps } from './list-devices-adjust.types';

defineOptions({
	name: 'ListDevicesAdjust',
});

const props = defineProps<IListDevicesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDevicesFilter): void;
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();

const { options: typesOptions } = useDevicesPlugins();

const states: ConnectionState[] = [
	ConnectionState.CONNECTED,
	ConnectionState.DISCONNECTED,
	ConnectionState.INIT,
	ConnectionState.READY,
	ConnectionState.RUNNING,
	ConnectionState.SLEEPING,
	ConnectionState.STOPPED,
	ConnectionState.LOST,
	ConnectionState.ALERT,
	ConnectionState.UNKNOWN,
];

const categories: string[] = Object.values(DevicesModuleDeviceCategory);

const activeBoxes = ref<string[]>(['types', 'states', 'categories']);

const innerFilters = useVModel(props, 'filters', emit);
</script>
