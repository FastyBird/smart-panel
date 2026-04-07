<template>
	<el-dialog
		:model-value="visible"
		:title="t('systemModule.headings.manage.restart')"
		width="520px"
		@close="emit('close')"
	>
		<p class="mb-4">
			{{ isGateway ? t('systemModule.messages.manage.confirmRestartGateway') : t('systemModule.messages.manage.confirmRestart') }}
		</p>

		<ul class="list-disc pl-5 mb-2 leading-relaxed">
			<li>
				<strong>{{ t('systemModule.buttons.restartService.title') }}</strong>
				— {{ t('systemModule.texts.manage.restartServiceDescription') }}
			</li>
			<li>
				<strong>{{ t('systemModule.buttons.restartSystem.title') }}</strong>
				— {{ t('systemModule.texts.manage.restartSystemDescription') }}
			</li>
		</ul>

		<template #footer>
			<div class="flex justify-end gap-2 w-full">
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
			</div>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog } from 'element-plus';

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
