<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('displaysModule.headings.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('displaysModule.subHeadings.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="darkMode"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('displaysModule.filters.darkMode.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.darkMode">
							<el-radio-button
								:label="t('displaysModule.filters.darkMode.values.enabled')"
								value="enabled"
							/>
							<el-radio-button
								:label="t('displaysModule.filters.darkMode.values.disabled')"
								value="disabled"
							/>
							<el-radio-button
								:label="t('displaysModule.filters.darkMode.values.all')"
								value="all"
							/>
						</el-radio-group>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="screenSaver"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('displaysModule.filters.screenSaver.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.screenSaver">
							<el-radio-button
								:label="t('displaysModule.filters.screenSaver.values.enabled')"
								value="enabled"
							/>
							<el-radio-button
								:label="t('displaysModule.filters.screenSaver.values.disabled')"
								value="disabled"
							/>
							<el-radio-button
								:label="t('displaysModule.filters.screenSaver.values.all')"
								value="all"
							/>
						</el-radio-group>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="states"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('displaysModule.filters.states.title') }}
						</el-text>
					</template>
					<el-checkbox-group
						v-model="innerFilters.states"
						class="flex flex-col px-4"
					>
						<el-checkbox
							v-for="state of displayStates"
							:key="state"
							:label="t(`displaysModule.states.${state}`)"
							:value="state"
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

				{{ t('displaysModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElRadioButton, ElRadioGroup, ElScrollbar, ElText, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../common';
import type { IDisplaysFilter } from '../composables/types';

import { type IListDisplaysAdjustProps } from './list-displays-adjust.types';

defineOptions({
	name: 'ListDisplaysAdjust',
});

const props = defineProps<IListDisplaysAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IDisplaysFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-displays-adjust');
const { t } = useI18n();

const activeBoxes = ref<string[]>(['darkMode', 'screenSaver', 'states']);

const innerFilters = useVModel(props, 'filters', emit);

const displayStates = ['connected', 'disconnected', 'lost', 'unknown'] as const;
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-displays-adjust.scss';
</style>
