<template>
	<el-select-v2
		v-model="selectedIcon"
		:options="options"
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

		<template #default="{ item }">
			<div class="flex flex-row items-center gap-2">
				<icon
					:icon="`${props.iconSet}:${item.value}`"
					class="w[20px] h[20px]"
				/>

				{{ `${item.label}` }}
			</div>
		</template>
	</el-select-v2>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { ElSelectV2 } from 'element-plus';

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
	(e: 'update:modelValue', selected: string | null): void;
}>();

const iconNames = computed<string[]>((): string[] => {
	if (props.iconSet === 'ic') {
		return Object.keys(icIcons.icons);
	}

	return Object.keys(mdiIcons.icons);
});

const selectedIcon = ref<string | undefined>(props.modelValue ?? '');

const filterIconsBy = ref<string>('');

const options = computed(() => {
	let icons = iconNames.value;

	if (filterIconsBy.value) {
		icons = icons.filter((icon) => icon.includes(filterIconsBy.value.toLowerCase()));
	}

	return icons.map((icon) => ({
		value: icon,
		label: icon,
	}));
});

const filterIcons = (query: string) => {
	filterIconsBy.value = query;
};

watch(
	(): string | undefined => selectedIcon.value,
	(val: string | undefined) => {
		emit('update:modelValue', typeof val === 'undefined' ? null : val);
	}
);
</script>
