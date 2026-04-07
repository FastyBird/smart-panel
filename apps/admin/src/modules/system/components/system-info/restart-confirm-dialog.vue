<template>
	<el-dialog
		:model-value="visible"
		:title="t('systemModule.headings.manage.restart')"
		width="420px"
		@close="emit('close')"
	>
		<div class="flex gap-3">
			<el-icon
				color="var(--el-color-warning)"
				:size="22"
				class="flex-shrink-0 mt-[2px]"
			>
				<icon icon="mdi:alert-circle-outline" />
			</el-icon>
			<div>
				<p class="mb-3">
					{{ isGateway ? t('systemModule.messages.manage.confirmRestartGateway') : t('systemModule.messages.manage.confirmRestart') }}
				</p>
				<p class="text-xs color-[var(--el-text-color-secondary)]">
					<strong>{{ t('systemModule.buttons.restartService.title') }}</strong>
					— {{ t('systemModule.texts.manage.restartServiceDescription') }}
					<br />
					<strong>{{ t('systemModule.buttons.restartSystem.title') }}</strong>
					— {{ t('systemModule.texts.manage.restartSystemDescription') }}
				</p>
			</div>
		</div>

		<template #footer>
			<el-button @click="emit('close')">
				{{ t('systemModule.buttons.cancel.title') }}
			</el-button>
			<el-button
				type="primary"
				@click="emit('service-restart')"
			>
				{{ t('systemModule.buttons.restartService.title') }}
			</el-button>
			<el-button
				type="danger"
				@click="emit('system-reboot')"
			>
				{{ t('systemModule.buttons.restartSystem.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

defineOptions({
	name: 'RestartConfirmDialog',
});

defineProps<{
	visible: boolean;
	isGateway: boolean;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'service-restart'): void;
	(e: 'system-reboot'): void;
}>();

const { t } = useI18n();
</script>
