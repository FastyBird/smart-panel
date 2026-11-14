<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-security-arm-form"
		data-test-id="automation-security-arm-form"
		@submit.prevent
	>
		<automation-node-target
			:device-id="text(props.config.device_id)"
			:channel-id="text(props.config.channel_id)"
			:property-id="text(props.config.property_id)"
			access="writable"
			:property-filter="isArmedState"
			:errors="[...errorsAt('device_id'), ...errorsAt('channel_id'), ...errorsAt('property_id')]"
			@change="(patch: Record<string, unknown>, field: string): void => form.update(patch, field)"
		/>

		<el-form-item
			:label="t('automations.editor.fields.security.armTo')"
			:error="errorText('armed_state')"
			required
			data-test-field="armed_state"
		>
			<automation-option-select
				:model-value="props.config.armed_state"
				:options="states"
				:placeholder="t('automations.editor.fields.security.armPlaceholder')"
				:disabled="props.disabled"
				name="armed_state"
				@update:model-value="(state: string | undefined): void => form.update({ armed_state: state }, 'armed_state')"
			/>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.security.noDisarm') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Arm alarm": the armed state property of the alarm channel of an alarm device, and the state to arm
 * to - home, away or night. Disarming is not offered: an automation may not disarm the alarm (ADR 0003,
 * decision 18), and there is no disarm action.
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElText } from 'element-plus';

import { DevicesModuleChannelCategory, DevicesModuleChannelPropertyCategory } from '../../../../openapi.constants';
import type { IChannelProperty } from '../../../devices/store/channels.properties.store.types';
import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AUTOMATION_ARM_STATES } from '../../nodes/nodes.constants';
import { SecurityArmConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationNodeTarget from './automation-node-target.vue';
import type { IAutomationOption } from './automation-option-select.types';
import AutomationOptionSelect from './automation-option-select.vue';

defineOptions({
	name: 'AutomationSecurityArmForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, SecurityArmConfigSchema);

const { errorsAt, errorText } = form;

const lookups = useAutomationNodeLookups();

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

// Only the armed state of an alarm channel can be armed, as the backend checks on save
const isArmedState = (property: IChannelProperty): boolean =>
	property.category === DevicesModuleChannelPropertyCategory.state &&
	lookups.channel(property.channel)?.category === DevicesModuleChannelCategory.alarm;

const states = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_ARM_STATES.map((state) => ({ value: state, label: t(`automations.editor.options.armedStates.${state}`) }))
);
</script>
