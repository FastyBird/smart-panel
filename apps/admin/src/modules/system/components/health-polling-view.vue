<template>
	<div class="text-center">
		<template v-if="!timedOut">
			<el-icon
				class="is-loading mb-4"
				:size="40"
			>
				<icon icon="mdi:loading" />
			</el-icon>

			<p class="font-size-[0.9rem]">
				{{ waitingMessage }}
			</p>
		</template>

		<template v-else>
			<el-alert
				type="warning"
				:closable="false"
				center
			>
				<div class="text-center">
					<span class="font-size-[0.9rem] font-bold">
						{{ timeoutMessage }}
					</span>
				</div>
			</el-alert>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

import { ElAlert, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

import { MODULES_PREFIX } from '../../../app.constants';
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

const timedOut = ref(false);

let timer: ReturnType<typeof setTimeout> | null = null;
let sawUnhealthy = false;
const startTime = Date.now();

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

	timer = setTimeout(checkHealth, 3000);
};

onMounted(() => {
	timer = setTimeout(checkHealth, 3000);
});

onUnmounted(() => {
	if (timer) {
		clearTimeout(timer);
	}
});
</script>
