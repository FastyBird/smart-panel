<template>
	<template v-if="props.row.display">
		<table-column-display-profile-display
			:display="props.row.display"
			:filters="props.filters"
			@filter-by="
				(value, add): void => {
					emit('filter-by', value, add);
				}
			"
		/>
	</template>

	<template v-else>
		<el-text truncated>
			<el-link
				:type="props.filters.displays.includes('all') ? 'danger' : undefined"
				underline="never"
				class="font-400!"
				@click.stop="emit('filter-by', 'all', !props.filters.displays.includes('all'))"
			>
				<el-icon class="el-icon--left">
					<icon
						v-if="props.filters.displays.includes('all')"
						icon="mdi:filter-minus"
					/>
					<icon
						v-else
						icon="mdi:filter-plus"
					/>
				</el-icon>

				{{ t('systemModule.texts.displaysProfiles.notSelected') }}
			</el-link>
		</el-text>
	</template>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElIcon, ElLink, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import TableColumnDisplayProfileDisplay from './table-column-display-profile-display.vue';
import type { ITableColumnDisplayProfileProps } from './table-column-display-profile.types';

defineOptions({
	name: 'TableColumnDisplayProfile',
});

const props = defineProps<ITableColumnDisplayProfileProps>();

const emit = defineEmits<{
	(e: 'filter-by', value: string, add: boolean): void;
}>();

const { t } = useI18n();
</script>
