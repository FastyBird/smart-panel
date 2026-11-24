<template>
	<!-- The empty states of the display list, for the table and the phone rows alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:monitor"
		:title="t('displaysModule.texts.loadingDisplays')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('displaysModule.texts.noFilteredDisplays')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-displays-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('displaysModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:monitor"
		:title="t('displaysModule.texts.noDisplays')"
		:description="t('displaysModule.texts.noDisplaysHint')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';

defineOptions({
	name: 'DisplaysEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
