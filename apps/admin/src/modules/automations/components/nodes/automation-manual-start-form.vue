<template>
	<div data-test-id="automation-manual-start-form">
		<el-text
			tag="p"
			size="small"
			type="info"
			class="mt-0! mb-2! leading-4!"
		>
			{{ t('automations.editor.form.nothingToConfigure') }}
		</el-text>
		<el-text
			tag="p"
			size="small"
			class="m-0! leading-4!"
		>
			{{ t('automations.editor.fields.manual.hint') }}
		</el-text>
	</div>
</template>

<script setup lang="ts">
/*
 * "Manual start" has nothing to configure; the form says how the automation is started by it.
 */
import { useI18n } from 'vue-i18n';

import { ElText } from 'element-plus';

import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

defineOptions({
	name: 'AutomationManualStartForm',
});

withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

defineEmits(automationNodeFormEmits);

const { t } = useI18n();
</script>
