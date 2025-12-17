<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('extensionsModule.headings.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('extensionsModule.subHeadings.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="kind"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('extensionsModule.filters.kind.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.kind">
							<el-radio-button
								:label="t('extensionsModule.states.all')"
								value="all"
							/>
							<el-radio-button
								:label="t('extensionsModule.labels.module')"
								value="module"
							/>
							<el-radio-button
								:label="t('extensionsModule.labels.plugin')"
								value="plugin"
							/>
						</el-radio-group>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="enabled"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('extensionsModule.filters.enabled.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.enabled">
							<el-radio-button
								:label="t('extensionsModule.states.all')"
								value="all"
							/>
							<el-radio-button
								:label="t('extensionsModule.labels.enabled')"
								value="enabled"
							/>
							<el-radio-button
								:label="t('extensionsModule.labels.disabled')"
								value="disabled"
							/>
						</el-radio-group>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="isCore"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('extensionsModule.filters.type.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.isCore">
							<el-radio-button
								:label="t('extensionsModule.states.all')"
								value="all"
							/>
							<el-radio-button
								:label="t('extensionsModule.labels.core')"
								value="core"
							/>
							<el-radio-button
								:label="t('extensionsModule.labels.addon')"
								value="addon"
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

				{{ t('extensionsModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCollapse, ElCollapseItem, ElRadioButton, ElRadioGroup, ElScrollbar, ElText, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../common';
import type { IExtensionsFilter } from '../composables/types';

import { type IListExtensionsAdjustProps } from './list-extensions-adjust.types';

defineOptions({
	name: 'ListExtensionsAdjust',
});

const props = defineProps<IListExtensionsAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IExtensionsFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-extensions-adjust');
const { t } = useI18n();

const activeBoxes = ref<string[]>(['kind', 'enabled', 'isCore']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-extensions-adjust.scss';
</style>
