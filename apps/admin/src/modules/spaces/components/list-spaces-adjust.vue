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
					name="type"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('spacesModule.filters.type.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.type">
							<el-radio-button
								:label="t('spacesModule.misc.types.room')"
								:value="SpaceType.ROOM"
							/>
							<el-radio-button
								:label="t('spacesModule.misc.types.zone')"
								:value="SpaceType.ZONE"
							/>
							<el-radio-button
								:label="t('spacesModule.filters.type.all')"
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

				{{ t('spacesModule.buttons.reset.title') }}
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
import { SpaceType } from '../spaces.constants';
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

const activeBoxes = ref<string[]>(['type']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-spaces-adjust.scss';
</style>
