<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('spacesModule.headings.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('spacesModule.subHeadings.adjustFilters') }}
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
							{{ t('spacesModule.filters.types.title') }}
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

		<div class="px-5 py-2 text-center">
			<el-button
				:disabled="!props.filtersActive"
				@click="emit('reset-filters')"
			>
				<template #icon>
					<icon icon="mdi:filter-remove" />
				</template>

				{{ t('spacesModule.buttons.reset.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElCheckbox, ElCheckboxGroup, ElCollapse, ElCollapseItem, ElScrollbar, ElText, useNamespace } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { AppBarHeading } from '../../../common';
import { useSpacesPlugins } from '../composables/useSpacesPlugins';
import type { ISpacesFilter } from '../composables/types';

interface IListSpacesAdjustProps {
	filters: ISpacesFilter;
	filtersActive: boolean;
}

defineOptions({
	name: 'ListSpacesAdjust',
});

const props = defineProps<IListSpacesAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: ISpacesFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-spaces-adjust');
const { t } = useI18n();

const { options: typesOptions } = useSpacesPlugins();

const activeBoxes = ref<string[]>(['types']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-spaces-adjust.scss';
</style>
