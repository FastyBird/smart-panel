<template>
	<div class="flex flex-col h-full p-4">
		<view-header
			:heading="t('spacesModule.headings.adjustFilters')"
			icon="mdi:filter"
		/>

		<el-form
			label-position="top"
			class="mt-4"
		>
			<el-form-item :label="t('spacesModule.fields.search.placeholder')">
				<el-input
					v-model="innerFilters.search"
					clearable
				>
					<template #suffix>
						<el-icon><icon icon="mdi:magnify" /></el-icon>
					</template>
				</el-input>
			</el-form-item>

			<el-form-item :label="t('spacesModule.filters.type.title')">
				<el-radio-group v-model="innerFilters.type">
					<el-radio-button
						:label="t('spacesModule.misc.types.room')"
						value="room"
					/>
					<el-radio-button
						:label="t('spacesModule.misc.types.zone')"
						value="zone"
					/>
					<el-radio-button
						:label="t('spacesModule.filters.type.all')"
						value="all"
					/>
				</el-radio-group>
			</el-form-item>
		</el-form>

		<div class="mt-auto">
			<el-button
				v-if="props.filtersActive"
				type="primary"
				plain
				class="w-full"
				@click="emit('reset-filters')"
			>
				<template #icon>
					<icon icon="mdi:filter-off" />
				</template>
				{{ t('spacesModule.buttons.resetFilters.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElForm, ElFormItem, ElIcon, ElInput, ElRadioButton, ElRadioGroup } from 'element-plus';

import { Icon } from '@iconify/vue';
import { useVModel } from '@vueuse/core';

import { ViewHeader } from '../../../common';
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

const { t } = useI18n();

const innerFilters = useVModel(props, 'filters', emit);
</script>
