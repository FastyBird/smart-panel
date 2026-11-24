<template>
	<!-- The empty states of the page list, for the table and the phone rows alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:view-dashboard"
		:title="t('dashboardModule.texts.pages.loadingPages')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('dashboardModule.texts.pages.noFilteredPages')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-pages-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('dashboardModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:view-dashboard"
		:title="t('dashboardModule.texts.pages.noPages')"
		:description="t('dashboardModule.texts.pages.noPagesHint')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../../common';

defineOptions({
	name: 'PagesEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
