<template>
	<state-view
		v-if="!timedOut"
		kind="loading"
		:title="waitingMessage"
		data-test-id="health-polling-waiting"
	/>

	<!-- Taking too long is not yet a failure: the system may still come back, so it can be watched again -->
	<div
		v-else
		class="flex flex-col gap-4"
		data-test-id="health-polling-timeout"
	>
		<el-alert
			type="warning"
			:title="timeoutMessage"
			:closable="false"
			show-icon
		/>

		<el-button
			size="large"
			class="w-full"
			data-test-id="health-polling-retry"
			@click="onRetry"
		>
			{{ t('systemModule.buttons.retry.title') }}
		</el-button>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton } from 'element-plus';

import { MODULES_PREFIX } from '../../../app.constants';
import { StateView } from '../../../common';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

defineOptions({
	name: 'HealthPollingView',
});

const props = withDefaults(
	defineProps<{
		waitingMessage: string;
		timeoutMessage: string;
		timeoutMs: number;
		onSuccess: () => void;
		waitForUnhealthy?: boolean;
	}>(),
	{
		waitForUnhealthy: false,
	},
);

const { t } = useI18n();

const timedOut = ref(false);

let timer: ReturnType<typeof setTimeout> | null = null;
let sawUnhealthy = false;
let startTime = Date.now();

const pollIntervalMs = 3000;
const initialPollMs = props.waitForUnhealthy ? 500 : pollIntervalMs;

const checkHealth = async (): Promise<void> => {
	try {
		const response = await fetch(`/api/v1/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/health`);

		if (response.ok) {
			if (!props.waitForUnhealthy || sawUnhealthy) {
				props.onSuccess();

				return;
			}

			// Service hasn't gone down yet — keep polling
		} else {
			sawUnhealthy = true;
		}
	} catch {
		// Backend is down — expected
		sawUnhealthy = true;
	}

	if (Date.now() - startTime > props.timeoutMs) {
		timedOut.value = true;

		return;
	}

	// Poll faster while waiting for the service to go down, slower once it's down
	const nextInterval = sawUnhealthy ? pollIntervalMs : 1000;

	timer = setTimeout(checkHealth, nextInterval);
};

// Watches for the same time again; whether the system went down is kept, so a system already back counts as back
const onRetry = (): void => {
	timedOut.value = false;
	startTime = Date.now();

	timer = setTimeout(checkHealth, pollIntervalMs);
};

onMounted(() => {
	timer = setTimeout(checkHealth, initialPollMs);
});

onUnmounted(() => {
	if (timer) {
		clearTimeout(timer);
	}
});
</script>
