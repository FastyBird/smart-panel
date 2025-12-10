<template>
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
	<span
		v-else
		class="text-gray-400"
	>
		{{ t('dashboardModule.table.pages.columns.display.all') }}
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTag } from 'element-plus';

import { useDisplays } from '../composables/composables';
import type { IDisplay } from '../store/displays.store.types';

defineOptions({
	name: 'TableColumnDisplay',
});

const { t } = useI18n();

const props = defineProps<{
	displayId?: IDisplay['id'] | null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	row?: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	filters?: any;
}>();

const displaysArray = computed<IDisplay['id'][] | null>(() => {
	if (props.row?.displays) {
		return props.row.displays;
	}
	return null;
});

const { displays: allDisplays } = useDisplays();

const displayItems = computed<IDisplay[]>(() => {
	if (!displaysArray.value || displaysArray.value.length === 0) {
		return [];
	}
	return allDisplays.value.filter((d) => displaysArray.value!.includes(d.id));
});
</script>
