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
				A filled circle button rather than a bare link: the badge anchors to the button box, so the
				count sits on the circle's corner the way every other badge-on-a-button does, instead of
				overlapping the icon itself.
			-->
			<!--
				The top bar is 44px tall inside an overflow-hidden container, and a badge sits half its
				height above the button it wraps - `offset` moves it down just enough to stay inside.
			-->
			<el-badge
				:value="unreadCount"
				:hidden="unreadCount === 0"
				:max="99"
				:offset="[0, 4]"
				class="notification-bell"
			>
				<el-button
					circle
					text
					bg
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
