<template>
	<!-- The empty states of the catalogue, for the cards and the table alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:puzzle"
		:title="t('extensionsModule.texts.loadingExtensions')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('extensionsModule.messages.noMatchingExtensions')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-extensions-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('extensionsModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:puzzle"
		:title="t('extensionsModule.texts.noExtensions')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';

defineOptions({
	name: 'ExtensionsEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
