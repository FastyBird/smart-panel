<template>
	<!-- Spec section 2: info, warning and danger tags; critical is the only filled one -->
	<status-tag
		:status="SEVERITY_STATUS[props.severity]"
		:label="t(`notificationsModule.severity.${props.severity}`)"
	/>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { StatusTag, type StatusTagStatus } from '../../../common';
import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

defineOptions({
	name: 'NotificationSeverityTag',
});

const props = defineProps<{
	severity: NotificationsModuleNotificationSeverity;
}>();

const { t } = useI18n();

const SEVERITY_STATUS: Record<NotificationsModuleNotificationSeverity, StatusTagStatus> = {
	[NotificationsModuleNotificationSeverity.info]: 'info',
	[NotificationsModuleNotificationSeverity.warning]: 'warn',
	[NotificationsModuleNotificationSeverity.error]: 'danger',
	[NotificationsModuleNotificationSeverity.critical]: 'critical',
};
</script>
