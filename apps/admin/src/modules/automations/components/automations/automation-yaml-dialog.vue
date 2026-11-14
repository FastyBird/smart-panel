<template>
	<el-dialog
		:model-value="props.visible"
		:title="t('automations.transfer.headings.yaml')"
		width="min(720px, 95vw)"
		data-test-id="automation-yaml-dialog"
		@update:model-value="(visible: boolean): void => emit('update:visible', visible)"
		@open="onOpen"
	>
		<el-alert
			v-if="props.unsaved"
			type="warning"
			:title="t('automations.transfer.texts.yamlUnsaved')"
			:closable="false"
			show-icon
			class="mb-2!"
			data-test-id="yaml-unsaved"
		/>

		<div
			v-if="loading"
			v-loading="true"
			class="h-[160px]"
		/>

		<el-result
			v-else-if="content === null"
			icon="error"
			:title="t('automations.transfer.messages.exportFailed')"
			data-test-id="yaml-failed"
		>
			<template #extra>
				<el-button
					type="primary"
					@click="onOpen"
				>
					{{ t('automations.buttons.retry.title') }}
				</el-button>
			</template>
		</el-result>

		<el-scrollbar
			v-else
			max-height="60vh"
		>
			<pre
				class="automation-yaml-dialog__content m-0 p-3 text-xs"
				data-test-id="yaml-content"
				>{{ content }}</pre
			>
		</el-scrollbar>

		<template #footer>
			<el-button @click="emit('update:visible', false)">
				{{ t('automations.buttons.close.title') }}
			</el-button>
			<el-button
				type="primary"
				:loading="exporting(props.automationId)"
				data-test-id="yaml-download"
				@click="exportAutomation(props.automationId)"
			>
				<template #icon>
					<icon icon="mdi:download" />
				</template>
				{{ t('automations.transfer.buttons.export.title') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
/*
 * "View as YAML": the stored automation as the document it is exported as, read only.
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDialog, ElResult, ElScrollbar, vLoading } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useAutomationExport } from '../../composables/useAutomationExport';

import type { IAutomationYamlDialogProps } from './automation-yaml-dialog.types';

defineOptions({
	name: 'AutomationYamlDialog',
});

const props = withDefaults(defineProps<IAutomationYamlDialogProps>(), {
	unsaved: false,
});

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
}>();

const { t } = useI18n();

const { exporting, fetchYaml, exportAutomation } = useAutomationExport();

const loading = ref<boolean>(false);

const content = ref<string | null>(null);

// Read on every open: the automation may have been saved since
const onOpen = async (): Promise<void> => {
	loading.value = true;

	try {
		content.value = await fetchYaml(props.automationId);
	} finally {
		loading.value = false;
	}
};
</script>

<style scoped>
.automation-yaml-dialog__content {
	font-family: var(--el-font-family-monospace, monospace);
	white-space: pre;
	background-color: var(--el-fill-color-light);
	border-radius: var(--el-border-radius-base);
}
</style>
