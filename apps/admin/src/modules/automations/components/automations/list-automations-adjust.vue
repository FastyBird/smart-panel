<template>
	<app-bar-heading teleport>
		<template #icon>
			<icon icon="mdi:filter" />
		</template>

		<template #title>
			{{ t('automations.headings.adjustFilters') }}
		</template>

		<template #subtitle>
			{{ t('automations.subHeadings.adjustFilters') }}
		</template>
	</app-bar-heading>

	<div
		:class="[ns.b()]"
		class="flex flex-col h-full w-full overflow-hidden"
	>
		<el-scrollbar class="flex-grow">
			<el-collapse v-model="activeBoxes">
				<el-collapse-item
					name="enabled"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('automations.filters.enabled.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-radio-group v-model="innerFilters.enabled">
							<el-radio-button
								:label="t('automations.filters.enabled.values.enabled')"
								value="enabled"
							/>
							<el-radio-button
								:label="t('automations.filters.enabled.values.disabled')"
								value="disabled"
							/>
							<el-radio-button
								:label="t('automations.filters.enabled.values.all')"
								value="all"
							/>
						</el-radio-group>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="statuses"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('automations.filters.status.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-select
							v-model="innerFilters.statuses"
							:placeholder="t('automations.filters.status.placeholder')"
							name="statuses"
							multiple
							clearable
						>
							<el-option
								v-for="status in statuses"
								:key="status"
								:label="t(`automations.statuses.${status}.title`)"
								:value="status"
							/>
						</el-select>
					</div>
				</el-collapse-item>

				<el-collapse-item
					name="spaces"
					:class="[ns.e('filter-item')]"
				>
					<template #title>
						<el-text class="!px-2">
							{{ t('automations.filters.space.title') }}
						</el-text>
					</template>

					<div class="px-2">
						<el-select
							v-model="innerFilters.spaceId"
							:placeholder="t('automations.filters.space.placeholder')"
							name="spaces"
							filterable
							clearable
						>
							<el-option
								v-for="space in spaceFilterOptions"
								:key="space.value"
								:label="space.label"
								:value="space.value"
							>
								<div class="flex items-center gap-2">
									<icon
										:icon="space.icon"
										class="text-lg"
									/>
									<span>{{ space.label }}</span>
								</div>
							</el-option>
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

				{{ t('automations.buttons.resetFilters.title') }}
			</el-button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElButton,
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
import { AutomationStatus, WHOLE_HOME_SPACE_FILTER } from '../../automations.constants';
import type { IAutomationsFilter } from '../../composables/types';
import { useAutomationSpaces } from '../../composables/useAutomationSpaces';

import type { IListAutomationsAdjustProps } from './list-automations-adjust.types';

defineOptions({
	name: 'ListAutomationsAdjust',
});

const props = defineProps<IListAutomationsAdjustProps>();

const emit = defineEmits<{
	(e: 'update:filters', filters: IAutomationsFilter): void;
	(e: 'reset-filters'): void;
}>();

const ns = useNamespace('list-automations-adjust');
const { t } = useI18n();

const statuses: AutomationStatus[] = Object.values(AutomationStatus);

const { spacesOptions } = useAutomationSpaces();

const spaceFilterOptions = computed<{ value: string; label: string; icon: string }[]>(() => [
	{
		value: WHOLE_HOME_SPACE_FILTER,
		label: t('automations.fields.wholeHome'),
		icon: 'mdi:home',
	},
	...spacesOptions.value,
]);

const activeBoxes = ref<string[]>(['enabled', 'statuses', 'spaces']);

const innerFilters = useVModel(props, 'filters', emit);
</script>

<style rel="stylesheet/scss" lang="scss" scoped>
@use 'list-automations-adjust.scss';
</style>
