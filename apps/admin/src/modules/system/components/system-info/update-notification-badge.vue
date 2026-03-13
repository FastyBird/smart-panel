<template>
	<el-badge
		v-if="showBadge"
		is-dot
		type="warning"
		class="update-badge"
	>
		<el-button
			circle
			link
			@click="onNavigateToUpdate"
		>
			<template #icon>
				<icon
					icon="mdi:cellphone-arrow-down"
					class="w[18px] h[18px]"
				/>
			</template>
		</el-button>
	</el-badge>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { ElBadge, ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useUpdateStatus } from '../../composables/composables';
import { RouteNames } from '../../system.constants';

defineOptions({
	name: 'UpdateNotificationBadge',
});

const router = useRouter();

const DISMISSED_VERSION_KEY = 'smart-panel:update-dismissed-version';

const { updateAvailable, latestVersion } = useUpdateStatus();

const dismissedVersion = ref<string | null>(localStorage.getItem(DISMISSED_VERSION_KEY));

const showBadge = computed<boolean>((): boolean => {
	if (!updateAvailable.value || !latestVersion.value) {
		return false;
	}

	return latestVersion.value !== dismissedVersion.value;
});

const onNavigateToUpdate = (): void => {
	// Dismiss the notification for this version
	if (latestVersion.value) {
		dismissedVersion.value = latestVersion.value;
		localStorage.setItem(DISMISSED_VERSION_KEY, latestVersion.value);
	}

	router.push({ name: RouteNames.SYSTEM_INFO });
};

// Reset dismissal when a new version becomes available
watch(latestVersion, (newVersion: string | null): void => {
	if (newVersion && newVersion !== dismissedVersion.value) {
		dismissedVersion.value = null;
		localStorage.removeItem(DISMISSED_VERSION_KEY);
	}
});

</script>

<style scoped>
.update-badge {
	display: flex;
	align-items: center;
}
</style>
