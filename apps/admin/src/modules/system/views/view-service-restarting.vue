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
				{{ t('systemModule.messages.manage.waitingServiceToBoot') }}
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
						{{ t('systemModule.messages.manage.serviceRestartTakesTooLong') }}
					</span>
				</div>
			</el-alert>
		</template>
	</div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElIcon, ElNotification } from 'element-plus';

import { Icon } from '@iconify/vue';

import { MODULES_PREFIX } from '../../../app.constants';
import { SYSTEM_MODULE_PREFIX } from '../system.constants';

defineOptions({
	name: 'ViewServiceRestarting',
});

const { t } = useI18n();

const timedOut = ref(false);

let timer: ReturnType<typeof setTimeout> | null = null;
const startTime = Date.now();
const timeoutMs = 30 * 1000; // 30 seconds

const checkHealth = async (): Promise<void> => {
	try {
		const response = await fetch(`/api/v1/${MODULES_PREFIX}/${SYSTEM_MODULE_PREFIX}/system/health`);

		if (response.ok) {
			ElNotification.success(t('systemModule.messages.manage.panelBackOnline'));

			window.location.href = '/';

			return;
		}
	} catch {
		// Backend still down — expected
	}

	if (Date.now() - startTime > timeoutMs) {
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
