<template>
	<!-- The empty states of the user list, for the table and the phone rows alike -->
	<state-view
		v-if="props.loading"
		kind="loading"
		icon="mdi:users-group"
		:title="t('usersModule.texts.misc.loadingUsers')"
	/>

	<state-view
		v-else-if="props.filtersActive"
		kind="empty"
		icon="mdi:filter-multiple"
		:title="t('usersModule.texts.misc.noFilteredUsers')"
	>
		<template #action>
			<el-button
				plain
				data-test-id="reset-users-filters-empty"
				@click="emit('reset-filters')"
			>
				{{ t('usersModule.buttons.resetFilters.title') }}
			</el-button>
		</template>
	</state-view>

	<state-view
		v-else
		kind="empty"
		icon="mdi:users-group"
		:title="t('usersModule.texts.misc.noUsers')"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton } from 'element-plus';

import { StateView } from '../../../common';

defineOptions({
	name: 'UsersEmpty',
});

const props = defineProps<{ loading: boolean; filtersActive: boolean }>();

const emit = defineEmits<{
	(e: 'reset-filters'): void;
}>();

const { t } = useI18n();
</script>
