<template>
	<el-dialog
		:model-value="modelValue"
		:title="t('mcpModule.token.title')"
		:close-on-click-modal="false"
		:close-on-press-escape="false"
		width="min(560px, calc(100vw - 32px))"
		@close="close"
	>
		<div class="flex flex-col gap-4">
			<el-alert
				type="warning"
				:title="t('mcpModule.token.warningTitle')"
				:description="t('mcpModule.token.warningDescription', { name: clientName })"
				:closable="false"
				show-icon
			/>

			<!-- Spec section 4: tokens in copy-field; shown once, never stored by the admin -->
			<copy-field
				:value="token"
				:label="t('mcpModule.token.label')"
				data-test-id="mcp-token"
			/>
		</div>

		<template #footer>
			<el-button
				type="primary"
				data-test-id="mcp-token-done"
				@click="close"
			>
				{{ t('mcpModule.actions.done') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog } from 'element-plus';

import { CopyField } from '../../../common';

defineOptions({ name: 'McpTokenDialog' });

defineProps<{
	modelValue: boolean;
	token: string;
	clientName: string;
}>();

const emit = defineEmits<{
	(e: 'update:model-value', value: boolean): void;
	(e: 'closed'): void;
}>();

const { t } = useI18n();

const close = (): void => {
	emit('update:model-value', false);
	emit('closed');
};
</script>
