<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-device-button-pressed-form"
		data-test-id="automation-device-button-pressed-form"
		@submit.prevent
	>
		<automation-node-target
			:device-id="text(props.config.device_id)"
			:channel-id="text(props.config.channel_id)"
			:property-id="text(props.config.property_id)"
			:property-filter="reportsPresses"
			:errors="[...errorsAt('device_id'), ...errorsAt('channel_id'), ...errorsAt('property_id')]"
			@change="onTarget"
		/>

		<el-form-item
			:label="t('automations.editor.fields.button.events.title')"
			:error="errorText('events')"
			data-test-field="events"
		>
			<el-select
				:model-value="events"
				:disabled="props.disabled"
				:placeholder="t(`automations.editor.fields.button.events.${known.length > 0 ? 'pick' : 'type'}`)"
				:filterable="known.length === 0"
				:allow-create="known.length === 0"
				:default-first-option="known.length === 0"
				:reserve-keyword="false"
				:multiple-limit="AUTOMATION_BUTTON_MAX_EVENTS"
				name="events"
				multiple
				@update:model-value="onEvents"
			>
				<el-option
					v-for="event in known.length > 0 ? [...known, ...events.filter((item) => !known.includes(item))] : events"
					:key="event"
					:label="event"
					:value="event"
				/>
			</el-select>
			<el-text
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ t('automations.editor.fields.button.events.hint') }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Button is pressed": the property a button reports its presses on - one that is read-only or carries
 * only events - and the presses to start on, every press when none is picked. A button that lists its
 * presses (an enum property) offers them; for any other the presses are typed in, as the integration
 * names them (`press`, `long_press`, `double_press`).
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect, ElText } from 'element-plus';

import { DevicesModuleChannelPropertyPermissions } from '../../../../openapi.constants';
import type { IChannelProperty } from '../../../devices/store/channels.properties.store.types';
import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AUTOMATION_BUTTON_MAX_EVENTS } from '../../nodes/nodes.constants';
import { DeviceButtonPressedConfigSchema } from '../../nodes/nodes.schemas';
import { enumValuesOf } from '../../nodes/nodes.values';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationNodeTarget from './automation-node-target.vue';

defineOptions({
	name: 'AutomationDeviceButtonPressedForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, DeviceButtonPressedConfigSchema);

const { errorsAt, errorText } = form;

const lookups = useAutomationNodeLookups();

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

// A button reports its presses on a property that is read-only or that only carries events
const reportsPresses = (property: IChannelProperty): boolean =>
	property.permissions.includes(DevicesModuleChannelPropertyPermissions.ev) ||
	property.permissions.includes(DevicesModuleChannelPropertyPermissions.ro);

const knownOf = (propertyId: unknown): string[] => {
	const id = text(propertyId);

	return id === null ? [] : enumValuesOf(lookups.property(id));
};

const known = computed<string[]>((): string[] => knownOf(props.config.property_id));

const events = computed<string[]>((): string[] =>
	Array.isArray(props.config.events) ? props.config.events.filter((event): event is string => typeof event === 'string') : []
);

const onEvents = (value: unknown[]): void => {
	const picked = [...new Set(value.map((event) => String(event).trim()).filter((event) => event !== ''))];

	form.update({ events: picked.length > 0 ? picked : undefined }, 'events');
};

const onTarget = (patch: Record<string, unknown>, field: string): void => {
	const next = 'property_id' in patch ? knownOf(patch.property_id) : known.value;

	// The presses picked stay only where the new button reports them too
	const kept = next.length > 0 ? events.value.filter((event) => next.includes(event)) : events.value;

	form.update({ ...patch, events: kept.length > 0 ? kept : undefined }, field);
};
</script>
