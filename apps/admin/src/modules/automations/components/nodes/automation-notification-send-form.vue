<template>
	<el-form
		label-position="top"
		class="automation-notification-send-form"
		data-test-id="automation-notification-send-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.notification.severity')"
			:error="errorText('severity')"
			required
			data-test-field="severity"
		>
			<el-select
				:model-value="text(props.config.severity)"
				:disabled="props.disabled"
				:placeholder="t('automations.editor.form.notSet')"
				name="severity"
				@update:model-value="(value: string): void => form.update({ severity: value }, 'severity')"
			>
				<el-option
					v-for="severity in AUTOMATION_NOTIFICATION_SEVERITIES"
					:key="severity"
					:label="t(`automations.editor.severities.${severity}`)"
					:value="severity"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('automations.editor.fields.notification.title')"
			:error="errorText('title')"
			required
			data-test-field="title"
		>
			<el-input
				:model-value="text(props.config.title) ?? ''"
				:disabled="props.disabled"
				:maxlength="AUTOMATION_NOTIFICATION_TITLE_MAX_LENGTH"
				name="title"
				show-word-limit
				@update:model-value="(value: string): void => form.update({ title: value }, 'title')"
			/>
		</el-form-item>

		<el-form-item
			:label="t('automations.editor.fields.notification.message')"
			:error="errorText('message')"
			data-test-field="message"
		>
			<el-input
				:model-value="text(props.config.message) ?? ''"
				:disabled="props.disabled"
				:maxlength="AUTOMATION_NOTIFICATION_MESSAGE_MAX_LENGTH"
				:rows="4"
				type="textarea"
				name="message"
				show-word-limit
				@update:model-value="(value: string): void => form.update({ message: value }, 'message')"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.notification.hint') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Send notification": how urgent it is, its title and its message, all plain text - nothing in them is
 * evaluated (design § Security and safety).
 */
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import {
	AUTOMATION_NOTIFICATION_MESSAGE_MAX_LENGTH,
	AUTOMATION_NOTIFICATION_SEVERITIES,
	AUTOMATION_NOTIFICATION_TITLE_MAX_LENGTH,
} from '../../nodes/nodes.constants';
import { NotificationSendConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

defineOptions({
	name: 'AutomationNotificationSendForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, NotificationSendConfigSchema);

const { errorText } = form;

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);
</script>
