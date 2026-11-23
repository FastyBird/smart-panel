<template>
	<!-- The empty states of the space list, for the table and the phone rows alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:home-group"
		:title="t('spacesModule.texts.loadingSpaces')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('spacesModule.texts.noFilteredSpaces')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-spaces-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('spacesModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:home-group"
		:title="t('spacesModule.texts.noSpaces')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';

defineOptions({
	name: 'SpacesEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
