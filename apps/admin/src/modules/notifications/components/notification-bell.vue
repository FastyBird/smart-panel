<template>
	<el-popover
		v-model:visible="popoverVisible"
		placement="bottom-end"
		:width="380"
		trigger="click"
		popper-class="notification-bell__popover"
	>
		<template #reference>
			<!--
				`offset` nudges the count up and to the right so that its 1px background-coloured rim -
				the badge's built-in separator - no longer cuts across the bell icon.
			-->
			<el-badge
				:value="unreadCount"
				:hidden="unreadCount === 0"
				:max="99"
				:offset="[8, -4]"
				class="notification-bell"
			>
				<el-button
					type="primary"
					circle
					link
					:aria-label="t('notificationsModule.texts.bell.title')"
				>
					<template #icon>
						<icon
							:icon="alert ? 'mdi:bell-alert' : 'mdi:bell-outline'"
							:class="{ 'notification-bell__icon--danger': alert }"
						/>
					</template>
				</el-button>
			</el-badge>
		</template>

		<notification-popover @close="popoverVisible = false" />
	</el-popover>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElBadge, ElButton, ElPopover } from 'element-plus';

import { Icon } from '@iconify/vue';

import { NotificationsModuleNotificationSeverity } from '../../../openapi.constants';
import { useNotifications } from '../composables/composables';

import NotificationPopover from './notification-popover.vue';

defineOptions({
	name: 'NotificationBell',
});

const { t } = useI18n();

const { unreadCount, highestActiveSeverity, fetchNotifications } = useNotifications();

const popoverVisible = ref<boolean>(false);

const alert = computed<boolean>(
	(): boolean =>
		highestActiveSeverity.value === NotificationsModuleNotificationSeverity.error ||
		highestActiveSeverity.value === NotificationsModuleNotificationSeverity.critical
);

onMounted((): void => {
	void fetchNotifications({ status: 'active' });
});
</script>

<style scoped>
.notification-bell__icon--danger {
	color: var(--el-color-danger);
}
</style>
