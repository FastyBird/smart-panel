<template>
	<!-- The empty states of the location list, for the table and the phone rows alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:map-marker-multiple"
		:title="t('weatherModule.texts.misc.loadingLocations')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('weatherModule.texts.misc.noFilteredLocations')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-locations-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('weatherModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:map-marker-multiple"
		:title="t('weatherModule.texts.misc.noLocations')"
		:description="t('weatherModule.texts.misc.noLocationsHint')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';

defineOptions({
	name: 'LocationsEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
