<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-automation-target-form"
		data-test-id="automation-automation-target-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.automation.title')"
			:error="selfTarget ? t('automations.editor.validation.automationSelf') : errorText('automation_id')"
			required
			data-test-field="automation_id"
		>
			<el-select
				:model-value="typeof props.config.automation_id === 'string' && props.config.automation_id !== '' ? props.config.automation_id : undefined"
				:disabled="props.disabled"
				:loading="areLoading"
				:placeholder="t('automations.editor.fields.automation.placeholder')"
				:no-data-text="t('automations.editor.fields.automation.empty')"
				name="automation_id"
				filterable
				@update:model-value="(automationId: string): void => form.update({ automation_id: automationId }, 'automation_id')"
			>
				<el-option
					v-for="automation in others"
					:key="automation.id"
					:label="automation.name"
					:value="automation.id"
					:disabled="automation.id === editedId"
				/>
			</el-select>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t(`automations.editor.fields.automation.hints.${action}`) }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Enable automation", "Disable automation" and "Run automation": the other automation acted on. The
 * automation being edited cannot be picked - an automation does not act on itself, and the backend refuses
 * it when it runs. One already configured stays listed, disabled, so its name shows with the problem.
 */
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { ElForm, ElFormItem, ElOption, ElSelect, ElText } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { useAutomations } from '../../composables/useAutomations';
import { AutomationBuiltInNodeType } from '../../nodes/nodes.constants';
import { AutomationTargetConfigSchema } from '../../nodes/nodes.schemas';
import type { IAutomation } from '../../store/automations.store.types';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

defineOptions({
	name: 'AutomationAutomationTargetForm',
});

const ACTIONS: Record<string, 'enable' | 'disable' | 'run'> = {
	[AutomationBuiltInNodeType.AUTOMATION_ENABLE]: 'enable',
	[AutomationBuiltInNodeType.AUTOMATION_DISABLE]: 'disable',
	[AutomationBuiltInNodeType.AUTOMATION_RUN]: 'run',
};

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const route = useRoute();

const form = useAutomationNodeForm(props, emit, AutomationTargetConfigSchema);

const { errorText } = form;

const { automations, areLoading } = useAutomations();

const { ensureAutomations } = useAutomationNodeLookups();

const action = computed<'enable' | 'disable' | 'run'>((): 'enable' | 'disable' | 'run' => ACTIONS[props.nodeType.type] ?? 'run');

// The automation being edited, from the route of the editor; none outside it
const editedId = computed<string | null>((): string | null => {
	const id = route?.params?.id;

	return typeof id === 'string' ? id : null;
});

const others = computed<IAutomation[]>((): IAutomation[] =>
	automations.value.filter((automation) => automation.id !== editedId.value || automation.id === props.config.automation_id)
);

const selfTarget = computed<boolean>((): boolean => editedId.value !== null && props.config.automation_id === editedId.value);

onBeforeMount((): void => {
	void ensureAutomations();
});
</script>
