<template>
	<!-- Template 3: the summary card at the top of a page's detail -->
	<el-card
		shadow="never"
		body-class="flex flex-wrap items-start gap-4 p-4!"
		data-test-id="page-summary"
	>
		<div
			class="flex items-center justify-center shrink-0 w-14 h-14 rounded-lg bg-fill-light text-regular"
			aria-hidden="true"
		>
			<icon
				:icon="pageIcon"
				width="32"
				height="32"
			/>
		</div>

		<div class="flex flex-col gap-1 min-w-[200px]">
			<span class="text-section">{{ props.page.title }}</span>
			<span class="text-help">{{ plugin?.name || props.page.type }}</span>
		</div>

		<kv-grid
			:items="items"
			:cols="3"
			class="flex-1 min-w-[280px]"
		/>
	</el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElCard } from 'element-plus';

import { Icon } from '@iconify/vue';

import { KvGrid, type KvGridItem } from '../../../../common';
import { useDisplays } from '../../../displays';
import { usePageIcon } from '../../composables/composables';
import { usePagesPlugin } from '../../composables/usePagesPlugin';
import type { IPage } from '../../store/pages.store.types';

defineOptions({
	name: 'PageSummary',
});

const props = defineProps<{ page: IPage }>();

const { t } = useI18n();

const { icon: pageIcon } = usePageIcon({ id: props.page.id });
const { plugin } = usePagesPlugin({ type: props.page.type });
const { displays } = useDisplays();

// No displays chosen means the page shows on all of them
const displaysLabel = computed<string>((): string => {
	const ids = props.page.displays ?? [];

	if (ids.length === 0) {
		return t('dashboardModule.table.pages.columns.display.all');
	}

	return ids
		.map((id) => displays.value.find((display) => display.id === id))
		.map((display, index) => display?.name || display?.macAddress || ids[index])
		.join(', ');
});

const items = computed<KvGridItem[]>((): KvGridItem[] => [
	{ label: t('dashboardModule.fields.pages.order.title'), value: props.page.order },
	{
		label: t('dashboardModule.fields.pages.showTopBar.title'),
		value: props.page.showTopBar ? t('dashboardModule.texts.misc.yes') : t('dashboardModule.texts.misc.no'),
	},
	{ label: t('dashboardModule.fields.pages.displays.title'), value: displaysLabel.value },
]);
</script>
