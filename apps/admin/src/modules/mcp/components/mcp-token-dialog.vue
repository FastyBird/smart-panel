<template>
	<el-dialog
		:model-value="modelValue"
		:title="t('mcpModule.token.title')"
		:close-on-click-modal="false"
		:close-on-press-escape="false"
		width="min(640px, 94vw)"
		@close="close"
	>
		<el-alert
			type="warning"
			:title="t('mcpModule.token.warningTitle')"
			:description="t('mcpModule.token.warningDescription', { name: clientName })"
			:closable="false"
			show-icon
			class="mb-4"
		/>

		<el-input
			:model-value="token"
			readonly
			type="textarea"
			:rows="5"
			name="oneTimeToken"
		/>

		<template #footer>
			<el-button @click="copyToken">
				<icon icon="mdi:content-copy" />
				{{ copied ? t('mcpModule.token.copied') : t('mcpModule.token.copy') }}
			</el-button>
			<el-button
				type="primary"
				@click="close"
			>
				{{ t('mcpModule.actions.done') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElInput } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useFlashMessage } from '../../../common';

defineOptions({ name: 'McpTokenDialog' });

const props = defineProps<{
	modelValue: boolean;
	token: string;
	clientName: string;
}>();

const emit = defineEmits<{
	(e: 'update:model-value', value: boolean): void;
	(e: 'closed'): void;
}>();

const { t } = useI18n();
const flashMessage = useFlashMessage();
const copied = ref(false);

const copyToken = async (): Promise<void> => {
	try {
		await navigator.clipboard.writeText(props.token);
		copied.value = true;
	} catch {
		flashMessage.error(t('mcpModule.messages.copyFailed'));
	}
};

const close = (): void => {
	emit('update:model-value', false);
	emit('closed');
};

watch(
	(): string => props.token,
	(): void => {
		copied.value = false;
	}
);
</script>
