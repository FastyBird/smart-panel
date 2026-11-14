<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="space-occupancy-form"
		data-test-id="space-occupancy-form"
		@submit.prevent
	>
		<space-automation-space-field
			:model-value="props.config.space_id"
			:error="errorText('space_id')"
			:disabled="props.disabled"
			@update:model-value="(spaceId: string | undefined): void => form.update({ space_id: spaceId }, 'space_id')"
		/>

		<el-form-item
			v-if="changed"
			:label="t('spacesHomeControlPlugin.automations.fields.occupancy.when')"
			:error="errorText('to')"
			data-test-field="to"
		>
			<automation-option-select
				:model-value="props.config.to"
				:options="states"
				:empty-label="t('spacesHomeControlPlugin.automations.fields.occupancy.anyChange')"
				:disabled="props.disabled"
				name="to"
				@update:model-value="(to: string | undefined): void => form.update({ to }, 'to')"
			/>
		</el-form-item>

		<el-form-item
			v-else
			:label="t('spacesHomeControlPlugin.automations.fields.occupancy.is')"
			:error="errorText('state')"
			required
			data-test-field="state"
		>
			<el-radio-group
				:model-value="typeof props.config.state === 'string' ? props.config.state : undefined"
				:disabled="props.disabled"
				name="state"
				@update:model-value="(state: string | number | boolean | undefined): void => form.update({ state }, 'state')"
			>
				<el-radio-button
					v-for="state in states"
					:key="state.value"
					:value="state.value"
					:data-test-option="state.value"
				>
					{{ state.label }}
				</el-radio-button>
			</el-radio-group>
		</el-form-item>

		<el-text
			tag="p"
			size="small"
			type="info"
			class="m-0! leading-4!"
		>
			{{ t(`spacesHomeControlPlugin.automations.fields.occupancy.hints.${changed ? 'changed' : 'is'}`) }}
		</el-text>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Space occupancy changes" and "Space is occupied": the room or zone, and the occupancy its detection
 * settled on - for the trigger, optionally only becoming occupied or only becoming vacant.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElRadioButton, ElRadioGroup, ElText } from 'element-plus';

import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../../../../modules/automations/components/canvas/automation-node-form.types';
import type { IAutomationOption } from '../../../../modules/automations/components/nodes/automation-option-select.types';
import AutomationOptionSelect from '../../../../modules/automations/components/nodes/automation-option-select.vue';
import { useAutomationNodeForm } from '../../../../modules/automations/composables/useAutomationNodeForm';
import { SPACE_OCCUPANCY_STATES, SpaceAutomationNodeType } from '../../automations/space-automations.constants';
import { SpaceOccupancyChangedConfigSchema, SpaceOccupancyIsConfigSchema } from '../../automations/space-automations.schemas';

import SpaceAutomationSpaceField from './space-automation-space-field.vue';

defineOptions({
	name: 'SpaceOccupancyForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const changed = computed<boolean>((): boolean => props.nodeType.type === SpaceAutomationNodeType.OCCUPANCY_CHANGED);

const form = useAutomationNodeForm(props, emit, changed.value ? SpaceOccupancyChangedConfigSchema : SpaceOccupancyIsConfigSchema);

const { errorText } = form;

const states = computed<IAutomationOption[]>((): IAutomationOption[] =>
	SPACE_OCCUPANCY_STATES.map((state) => ({ value: state, label: t(`spacesHomeControlPlugin.occupancy.${state}`) }))
);
</script>
