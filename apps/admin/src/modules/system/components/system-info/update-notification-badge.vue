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
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { ElBadge, ElButton } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useBackend } from '../../../../common';
import { MODULES_PREFIX } from '../../../../app.constants';
import { onUpdateEvent } from '../../services/update-events.service';
import { RouteNames, SYSTEM_MODULE_PREFIX } from '../../system.constants';

defineOptions({
	name: 'UpdateNotificationBadge',
});

const router = useRouter();
const backend = useBackend();

const DISMISSED_VERSION_KEY = 'smart-panel:update-dismissed-version';
const UPDATE_STATUS_PATH = `/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/update/status`;

const updateAvailable = ref<boolean>(false);
const latestVersion = ref<string | null>(null);
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

const applyStatusEvent = (payload: Record<string, unknown>): void => {
	// The WS payload contains status/phase/progress_percent/message/error,
	// not version info. Re-fetch from API when an update completes or fails
	// to get the latest version information.
	const eventStatus = payload.status as string | undefined;

	if (eventStatus === 'complete' || eventStatus === 'failed') {
		void fetchInitialStatus();
	}
};

const fetchInitialStatus = async (): Promise<void> => {
	try {
		const response = await backend.client.GET(UPDATE_STATUS_PATH as never);

		const responseData = response.data as { data?: Record<string, unknown> } | undefined;

		if (responseData?.data) {
			updateAvailable.value = (responseData.data.update_available as boolean) ?? false;
			latestVersion.value = (responseData.data.latest_version as string) ?? null;
		}
	} catch {
		// Silently fail
	}
};

const unsubscribe = onUpdateEvent(applyStatusEvent);

onMounted((): void => {
	void fetchInitialStatus();
});

onUnmounted((): void => {
	unsubscribe();
});
</script>

<style scoped>
.update-badge {
	display: flex;
	align-items: center;
}
</style>
