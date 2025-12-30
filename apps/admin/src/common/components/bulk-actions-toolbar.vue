<template>
	<transition name="fade">
		<div
			v-if="props.selectedCount > 0"
			class="flex items-center gap-2"
		>
			<el-tag
				type="info"
				effect="plain"
				class="mr-1"
			>
				{{ t('application.bulkActions.selected', { count: props.selectedCount }) }}
			</el-tag>

			<el-button
				v-for="action in props.actions"
				:key="action.key"
				size="small"
				:type="action.type"
				plain
				@click="emit('action', action.key)"
			>
				<template #icon>
					<icon :icon="action.icon" />
				</template>

				{{ action.label }}
			</el-button>

			<el-divider direction="vertical" />
		</div>
	</transition>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDivider, ElTag } from 'element-plus';

import { Icon } from '@iconify/vue';

import type { IBulkActionsToolbarProps } from './bulk-actions-toolbar.types';

defineOptions({
	name: 'BulkActionsToolbar',
});

const props = defineProps<IBulkActionsToolbarProps>();

const emit = defineEmits<{
	(e: 'action', key: string): void;
}>();

const { t } = useI18n();
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
