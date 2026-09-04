<template>
	<span
		:class="['notification-severity-dot', `notification-severity-dot--${props.severity}`]"
		:title="label"
		:aria-label="label"
		role="img"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

defineOptions({
	name: 'NotificationSeverityDot',
});

const props = defineProps<{
	severity: NotificationsModuleNotificationSeverity;
}>();

const { t } = useI18n();

const label = computed<string>((): string => t(`notificationsModule.severity.${props.severity}`));
</script>

<style scoped>
.notification-severity-dot {
	display: inline-block;
	flex-shrink: 0;
	width: 0.625rem;
	height: 0.625rem;
	border-radius: 50%;
	background-color: var(--el-color-info);
}

.notification-severity-dot--warning {
	background-color: var(--el-color-warning);
}

.notification-severity-dot--error,
.notification-severity-dot--critical {
	background-color: var(--el-color-danger);
}

/* Critical stands out even next to error: a halo in the danger tint. */
.notification-severity-dot--critical {
	box-shadow: 0 0 0 2px var(--el-color-danger-light-7);
}
</style>
