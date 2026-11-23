<template>
	<!-- The empty states of the scene list, for the table and the phone rows alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:play-box-multiple"
		:title="t('scenes.texts.loadingScenes')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('scenes.texts.noFilteredScenes')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-scenes-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('scenes.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:play-box-multiple"
		:title="t('scenes.texts.noScenes')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../../common';

defineOptions({
	name: 'ScenesEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
