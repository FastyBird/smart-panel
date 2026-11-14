<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-security-state-changed-form"
		data-test-id="automation-security-state-changed-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.security.kind')"
			:error="errorText('kind')"
			required
			data-test-field="kind"
		>
			<el-radio-group
				:model-value="kind ?? undefined"
				:disabled="props.disabled"
				name="kind"
				@update:model-value="onKind"
			>
				<el-radio-button
					v-for="option in AUTOMATION_SECURITY_STATE_KINDS"
					:key="option"
					:value="option"
					:data-test-option="option"
				>
					{{ t(`automations.editor.options.securityKinds.${option}`) }}
				</el-radio-button>
			</el-radio-group>
		</el-form-item>

		<template v-if="kind !== null">
			<el-form-item
				v-for="field in ['from', 'to'] as const"
				:key="field"
				:label="t(`automations.editor.fields.change.${field}`)"
				:error="errorText(field)"
				:data-test-field="field"
			>
				<automation-option-select
					:model-value="props.config[field]"
					:options="states"
					:empty-label="t('automations.editor.fields.change.anyState')"
					:disabled="props.disabled"
					:name="field"
					@update:model-value="(state: string | undefined): void => form.update({ [field]: state }, field)"
				/>
			</el-form-item>
		</template>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Security state changes": which state is watched - the armed state (disarmed, armed home, ...) or the
 * alarm state (idle, triggered, ...) - and, optionally, the state it changes to or from. "The alarm goes
 * off" is the alarm state changing to triggered.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElRadioButton, ElRadioGroup } from 'element-plus';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { AUTOMATION_SECURITY_STATES_BY_KIND, AUTOMATION_SECURITY_STATE_KINDS, type AutomationSecurityStateKind } from '../../nodes/nodes.constants';
import { SecurityStateChangedConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import type { IAutomationOption } from './automation-option-select.types';
import AutomationOptionSelect from './automation-option-select.vue';

defineOptions({
	name: 'AutomationSecurityStateChangedForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SecurityStateChangedConfigSchema);

const { errorText } = form;

const isKind = (value: unknown): value is AutomationSecurityStateKind =>
	typeof value === 'string' && (AUTOMATION_SECURITY_STATE_KINDS as readonly string[]).includes(value);

const kind = computed<AutomationSecurityStateKind | null>((): AutomationSecurityStateKind | null =>
	isKind(props.config.kind) ? props.config.kind : null
);

const groupOf = (value: AutomationSecurityStateKind): string => (value === 'armed' ? 'armedStates' : 'alarmStates');

const states = computed<IAutomationOption[]>((): IAutomationOption[] =>
	kind.value === null
		? []
		: AUTOMATION_SECURITY_STATES_BY_KIND[kind.value].map((state) => ({
				value: state,
				label: t(`automations.editor.options.${groupOf(kind.value as AutomationSecurityStateKind)}.${state}`),
			}))
);

// The states of one kind are not states of the other, so a state picked for the old kind is dropped
const onKind = (value: string | number | boolean | undefined): void => {
	if (!isKind(value)) return;

	const allowed = AUTOMATION_SECURITY_STATES_BY_KIND[value];
	const keep = (field: 'to' | 'from'): unknown => (allowed.includes(String(props.config[field])) ? props.config[field] : undefined);

	form.update({ kind: value, to: keep('to'), from: keep('from') }, 'kind');
};
</script>
