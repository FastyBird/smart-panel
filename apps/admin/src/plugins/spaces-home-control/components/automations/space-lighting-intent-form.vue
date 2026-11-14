<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="space-lighting-intent-form"
		data-test-id="space-lighting-intent-form"
		@submit.prevent
	>
		<space-automation-space-field
			:model-value="props.config.space_id"
			:error="errorText('space_id')"
			:disabled="props.disabled"
			@update:model-value="(spaceId: string | undefined): void => form.update({ space_id: spaceId }, 'space_id')"
		/>

		<el-form-item
			:label="t('spacesHomeControlPlugin.automations.fields.lighting.intent')"
			:error="errorText('intent')"
			required
			data-test-field="intent"
		>
			<automation-option-select
				:model-value="props.config.intent"
				:options="intents"
				:placeholder="t('spacesHomeControlPlugin.automations.fields.lighting.intentPlaceholder')"
				:disabled="props.disabled"
				name="intent"
				@update:model-value="onIntent"
			/>
		</el-form-item>

		<el-form-item
			v-if="uses('mode')"
			:label="t('spacesHomeControlPlugin.automations.fields.lighting.mode')"
			:error="errorText('mode')"
			required
			data-test-field="mode"
		>
			<automation-option-select
				:model-value="props.config.mode"
				:options="lightingModes"
				:placeholder="t('spacesHomeControlPlugin.automations.fields.lighting.modePlaceholder')"
				:disabled="props.disabled"
				name="mode"
				@update:model-value="(mode: string | undefined): void => form.update({ mode }, 'mode')"
			/>
		</el-form-item>

		<el-form-item
			v-if="uses('role')"
			:label="t('spacesHomeControlPlugin.automations.fields.lighting.role')"
			:error="errorText('role')"
			required
			data-test-field="role"
		>
			<automation-option-select
				:model-value="props.config.role"
				:options="roles"
				:placeholder="t('spacesHomeControlPlugin.automations.fields.lighting.rolePlaceholder')"
				:disabled="props.disabled"
				name="role"
				@update:model-value="(role: string | undefined): void => form.update({ role }, 'role')"
			/>
		</el-form-item>

		<el-form-item
			v-if="uses('brightness')"
			:label="t('spacesHomeControlPlugin.automations.fields.lighting.brightness')"
			:error="errorText('brightness')"
			required
			data-test-field="brightness"
		>
			<el-input-number
				:model-value="brightness"
				:min="bounds.min"
				:max="bounds.max"
				:precision="bounds.precision"
				:step="5"
				:disabled="props.disabled"
				:value-on-clear="null"
				name="brightness"
				controls-position="right"
				class="w-full!"
				@update:model-value="(value: number | null | undefined): void => form.update({ brightness: value ?? undefined }, 'brightness')"
			>
				<template #suffix>%</template>
			</el-input-number>
		</el-form-item>

		<el-text
			tag="p"
			size="small"
			type="info"
			class="m-0! leading-4!"
		>
			{{ t('spacesHomeControlPlugin.automations.fields.lighting.hint') }}
		</el-text>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Set space lighting": the room or zone, and the lighting intent to send it - lights on or off, a
 * lighting mode, or the lights of one role on, off or dimmed. Each intent takes only its own fields: the
 * backend refuses one another intent uses, so the fields of the intent left are dropped when it changes.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInputNumber, ElText } from 'element-plus';

import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../../../../modules/automations/components/canvas/automation-node-form.types';
import type { IAutomationOption } from '../../../../modules/automations/components/nodes/automation-option-select.types';
import AutomationOptionSelect from '../../../../modules/automations/components/nodes/automation-option-select.vue';
import { useAutomationNodeForm } from '../../../../modules/automations/composables/useAutomationNodeForm';
import { type IAutomationNumberBounds, numberInputBounds } from '../../../../modules/automations/nodes/nodes.values';
import {
	SPACE_LIGHTING_FIELDS,
	SPACE_LIGHTING_FIELDS_OF_INTENT,
	SPACE_LIGHTING_INTENTS,
	SPACE_LIGHTING_MODES,
	SPACE_LIGHTING_ROLES,
	type SpaceLightingField,
	type SpaceLightingIntent,
} from '../../automations/space-automations.constants';
import { SpaceLightingIntentConfigSchema } from '../../automations/space-automations.schemas';

import SpaceAutomationSpaceField from './space-automation-space-field.vue';

defineOptions({
	name: 'SpaceLightingIntentForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SpaceLightingIntentConfigSchema);

const { errorText } = form;

const isIntent = (value: unknown): value is SpaceLightingIntent =>
	typeof value === 'string' && (SPACE_LIGHTING_INTENTS as readonly string[]).includes(value);

const intent = computed<SpaceLightingIntent | null>((): SpaceLightingIntent | null => (isIntent(props.config.intent) ? props.config.intent : null));

const uses = (field: SpaceLightingField): boolean => intent.value !== null && SPACE_LIGHTING_FIELDS_OF_INTENT[intent.value].includes(field);

const intents = computed<IAutomationOption[]>((): IAutomationOption[] =>
	SPACE_LIGHTING_INTENTS.map((value) => ({ value, label: t(`spacesHomeControlPlugin.automations.fields.lighting.intents.${value}`) }))
);

const lightingModes = computed<IAutomationOption[]>((): IAutomationOption[] =>
	SPACE_LIGHTING_MODES.map((value) => ({ value, label: t(`spacesHomeControlPlugin.activityModes.lightingModes.${value}`) }))
);

const roles = computed<IAutomationOption[]>((): IAutomationOption[] =>
	SPACE_LIGHTING_ROLES.map((value) => ({ value, label: t(`spacesHomeControlPlugin.lightingRoles.${value}`) }))
);

const brightness = computed<number | undefined>((): number | undefined =>
	typeof props.config.brightness === 'number' ? props.config.brightness : undefined
);

// A brightness saved out of range is shown as it is, with the error beside it, until it is edited
const bounds = computed<IAutomationNumberBounds>(
	(): IAutomationNumberBounds => numberInputBounds(brightness.value, { min: 0, max: 100, precision: 0 })
);

const onIntent = (value: string | undefined): void => {
	const used = isIntent(value) ? SPACE_LIGHTING_FIELDS_OF_INTENT[value] : [];

	// What the new intent uses is kept - the role from "role on" to "role brightness" - the rest dropped
	const patch: Record<string, unknown> = { intent: value };

	for (const field of SPACE_LIGHTING_FIELDS) {
		if (!used.includes(field)) patch[field] = undefined;
	}

	form.update(patch, 'intent');
};
</script>
