<template>
	<el-select
		v-model="selectedIcon"
		:placeholder="props.placeholder"
		:filter-method="filterIcons"
		size="large"
		clearable
		filterable
	>
		<template #label="{ label, value }">
			<div class="flex flex-row items-center gap-2">
				<icon
					:icon="`${props.iconSet}:${value}`"
					class="w[20px] h[20px]"
				/>

				{{ label }}
			</div>
		</template>

		<dynamic-scroller
			class="scroller"
			:items="filteredIcons"
			:item-size="32"
			:min-item-size="32"
			:buffer="300"
		>
			<template #default="{ item, index, active }">
				<DynamicScrollerItem
					:item="item"
					:active="active"
					:size-dependencies="[item.message]"
					:data-index="index"
				>
					<el-option
						:key="item"
						:label="`${props.iconSet}:${item}`"
						:value="item"
					>
						<div class="flex flex-row items-center gap-2">
							<icon
								:icon="`${props.iconSet}:${item}`"
								class="w[20px] h[20px]"
							/>

							{{ `${props.iconSet}:${item}` }}
						</div>
					</el-option>
				</DynamicScrollerItem>
			</template>
		</dynamic-scroller>
	</el-select>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
// @ts-expect-error This plugin is without TS support
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller';

import { ElOption, ElSelect } from 'element-plus';

import icIcons from '@iconify/json/json/ic.json';
import mdiIcons from '@iconify/json/json/mdi.json';
import { Icon } from '@iconify/vue';

import type { IIconPickerProps } from './icon-picker.types';

defineOptions({
	name: 'IconPicker',
});

const props = withDefaults(defineProps<IIconPickerProps>(), {
	iconSet: 'mdi',
});

const emit = defineEmits<{
	(e: 'update:model', selected: string): void;
}>();

const iconNames = computed<string[]>((): string[] => {
	if (props.iconSet === 'ic') {
		return Object.keys(icIcons.icons);
	}

	return Object.keys(mdiIcons.icons);
});

const selectedIcon = ref<string>(props.model);

const filteredIcons = ref(iconNames.value.slice(0, 1000));

const filterIcons = (query: string) => {
	filteredIcons.value = iconNames.value.filter((icon) => icon.includes(query.toLowerCase())).slice(0, 100);
};

watch(
	(): string => selectedIcon.value,
	(val: string) => {
		emit('update:model', val);
	}
);
</script>
