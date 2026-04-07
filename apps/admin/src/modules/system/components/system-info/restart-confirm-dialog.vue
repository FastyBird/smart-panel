<template>
	<el-dialog
		:model-value="visible"
		:title="t('systemModule.headings.manage.restart')"
		width="420px"
		@close="emit('close')"
	>
		<div class="flex items-center gap-2 mb-4">
			<el-icon
				color="var(--el-color-warning)"
				:size="22"
			>
				<icon icon="mdi:alert-circle-outline" />
			</el-icon>
			<span>{{ message }}</span>
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElIcon } from 'element-plus';

import { Icon } from '@iconify/vue';

defineOptions({
	name: 'RestartConfirmDialog',
});

const props = defineProps<{
	visible: boolean;
	isGateway: boolean;
}>();

const emit = defineEmits<{
	(e: 'close'): void;
	(e: 'service-restart'): void;
	(e: 'system-reboot'): void;
}>();

const { t } = useI18n();

const message = computed<string>(() =>
	props.isGateway ? t('systemModule.messages.manage.confirmRestartGateway') : t('systemModule.messages.manage.confirmRestart'),
);
</script>
