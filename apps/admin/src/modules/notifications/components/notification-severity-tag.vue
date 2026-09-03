<template>
	<el-tag
		:type="tagType"
		:effect="effect"
		size="small"
	>
		{{ label }}
	</el-tag>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElTag } from 'element-plus';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';

defineOptions({
	name: 'NotificationSeverityTag',
});

const props = defineProps<{
	severity: NotificationsModuleNotificationSeverity;
}>();

const { t } = useI18n();

const tagType = computed<'info' | 'warning' | 'danger'>((): 'info' | 'warning' | 'danger' => {
	switch (props.severity) {
		case NotificationsModuleNotificationSeverity.warning:
			return 'warning';
		case NotificationsModuleNotificationSeverity.error:
		case NotificationsModuleNotificationSeverity.critical:
			return 'danger';
		default:
			return 'info';
	}
});

// Critical stands out even among the two danger-tagged severities.
const effect = computed<'light' | 'dark'>((): 'light' | 'dark' =>
	props.severity === NotificationsModuleNotificationSeverity.critical ? 'dark' : 'light'
);

const label = computed<string>((): string => t(`notificationsModule.severity.${props.severity}`));
</script>
