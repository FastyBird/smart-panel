<template>
	<div
		v-if="notification.actions.length > 0"
		class="notification-actions"
	>
		<el-button
			v-for="(action, index) in notification.actions"
			:key="index"
			size="small"
			:type="action.primary ? 'primary' : 'default'"
			:loading="isExecuting"
			:disabled="isExecuting"
			@click.stop="onExecute(action)"
		>
			{{ action.label }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { ElButton } from 'element-plus';

import { useNotificationAction } from '../composables/composables';
import type { INotification, INotificationAction } from '../store/notifications.store.schemas';

defineOptions({
	name: 'NotificationActions',
});

const props = defineProps<{
	notification: INotification;
}>();

const { execute, isExecuting } = useNotificationAction();

const onExecute = (action: INotificationAction): void => {
	void execute(props.notification, action);
};
</script>

<style scoped>
.notification-actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.375rem;
}
</style>
