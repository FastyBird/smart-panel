<template>
	<!-- Support both old interface (single display) and new interface (displays array) -->
	<template v-if="displaysArray && displaysArray.length > 0">
		<el-tag
			v-for="displayItem in displayItems"
			:key="displayItem.id"
			size="small"
			class="mr-1"
		>
			{{ displayItem.name || displayItem.macAddress }}
		</el-tag>
	</template>
	<template v-else-if="singleDisplay">
		{{ singleDisplay.name || singleDisplay.macAddress }}
	</template>
	<span
		v-else
		class="text-gray-400"
	>
		{{ t('dashboardModule.table.pages.columns.display.all') }}
	</span>
</template>

<script setup lang="ts">
import { computed, type Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTag } from 'element-plus';

import { useDisplay, useDisplays } from '../composables/composables';
import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'TableColumnDisplay',
});

const { t } = useI18n();

// Support both old interface (row with display property) and new interface (displayId or displays)
const props = defineProps<{
	displayId?: IDisplay['id'] | null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row?: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	filters?: any;
}>();

// Extract display ID(s) from either prop format
const resolvedDisplayId = computed<IDisplay['id'] | null>(() => {
	if (props.displayId) {
		return props.displayId;
	}
	// Legacy support: single display
	if (props.row?.display) {
		return props.row.display;
	}
	return null;
});

const displaysArray = computed<IDisplay['id'][] | null>(() => {
	if (props.row?.displays) {
		return props.row.displays;
	}
	return null;
});

const displayIdRef: Ref<IDisplay['id'] | null> = ref(resolvedDisplayId.value);

watch(resolvedDisplayId, (newVal) => {
	displayIdRef.value = newVal;
});

const { display: singleDisplay } = useDisplay(displayIdRef);
const { displays: allDisplays } = useDisplays();

const displayItems = computed<IDisplay[]>(() => {
	if (!displaysArray.value || displaysArray.value.length === 0) {
		return [];
	}
	return allDisplays.value.filter((d) => displaysArray.value!.includes(d.id));
});
</script>
