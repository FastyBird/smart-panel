<template>
	<!-- Template 5's one health banner: a power or temperature problem first, then an update waiting, then power and
	     temperature not reported (unsupported board, failed or pending read), else all well. "All well" speaks only of
	     what was read: the power supply and the temperature -->
	<el-alert
		:type="alertType"
		:title="title"
		:description="description"
		:closable="false"
		show-icon
		data-test-id="system-health-banner"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert } from 'element-plus';

import { useUpdateStatus } from '../../composables/composables';
import type { IThrottleStatus } from '../../store/throttle-status.store.types';
import { throttleProblems } from '../../utils/system.utils';

defineOptions({
	name: 'SystemHealthBanner',
});

const props = defineProps<{
	throttleStatus: IThrottleStatus | null;
}>();

const { t } = useI18n();

const { updateAvailable, latestVersion } = useUpdateStatus();

const problems = computed<(keyof IThrottleStatus)[]>(() => throttleProblems(props.throttleStatus));

// No throttle status: the board does not report it, or it is not read (yet); its health is not known
const unknown = computed<boolean>(() => props.throttleStatus === null);

const alertType = computed<'success' | 'warning' | 'error' | 'info'>(() => {
	if (problems.value.length > 0) {
		return 'error';
	}

	if ((updateAvailable.value && latestVersion.value) || unknown.value) {
		return 'info';
	}

	return 'success';
});

const title = computed<string>(() => {
	if (problems.value.length > 0) {
		return t('systemModule.health.problemTitle');
	}

	if (updateAvailable.value && latestVersion.value) {
		return t('systemModule.texts.update.available', { version: latestVersion.value });
	}

	if (unknown.value) {
		return t('systemModule.health.unknownTitle');
	}

	return t('systemModule.health.okTitle');
});

const description = computed<string>(() => {
	if (problems.value.length > 0) {
		return problems.value.map((key) => t(`systemModule.systemInfo.${key}`)).join(' · ');
	}

	// Not knowing the power and temperature outweighs the hint where to install: the update is named in the title
	if (unknown.value) {
		return t('systemModule.health.unknownDescription');
	}

	if (updateAvailable.value && latestVersion.value) {
		return t('systemModule.health.updateDescription');
	}

	return t('systemModule.health.okDescription');
});
</script>
