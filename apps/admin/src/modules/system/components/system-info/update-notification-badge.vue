<template>
	<el-tooltip
		v-if="updateAvailable && latestVersion"
		:content="t('system.texts.update.available', { version: latestVersion })"
		placement="bottom"
	>
		<el-button
			type="warning"
			text
			bg
			size="small"
			class="update-btn"
			@click="onNavigateToUpdate"
		>
			<template #icon>
				<icon
					icon="mdi:update"
					class="w-[16px] h-[16px]"
				/>
			</template>
			<span class="hidden sm:inline">{{ t('system.buttons.update.headerAction') }}</span>
		</el-button>
	</el-tooltip>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { ElButton, ElTooltip } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useUpdateStatus } from '../../composables/composables';
import { RouteNames } from '../../system.constants';

defineOptions({
	name: 'UpdateNotificationBadge',
});

const { t } = useI18n();
const router = useRouter();

const { updateAvailable, latestVersion, fetchStatus } = useUpdateStatus();

const onNavigateToUpdate = (): void => {
	router.push({ name: RouteNames.SYSTEM_INFO });
};

onMounted((): void => {
	void fetchStatus();
});
</script>

<style scoped>
.update-btn {
	font-weight: 500;
}
</style>
