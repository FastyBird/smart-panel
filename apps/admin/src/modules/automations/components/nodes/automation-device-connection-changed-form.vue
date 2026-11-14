<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-device-connection-changed-form"
		data-test-id="automation-device-connection-changed-form"
		@submit.prevent
	>
		<el-form-item
			:label="t('automations.editor.fields.device.title')"
			:error="errorText('device_id')"
			required
			data-test-field="device_id"
		>
			<el-select
				:model-value="typeof props.config.device_id === 'string' ? props.config.device_id : undefined"
				:disabled="props.disabled"
				:loading="areLoading"
				:placeholder="t('automations.editor.fields.device.placeholder')"
				:no-data-text="t('automations.editor.fields.device.empty')"
				name="device_id"
				filterable
				@update:model-value="(deviceId: string): void => form.update({ device_id: deviceId }, 'device_id')"
			>
				<el-option
					v-for="device in sortedDevices"
					:key="device.id"
					:label="device.name"
					:value="device.id"
				/>
			</el-select>
		</el-form-item>

		<el-form-item
			:label="t('automations.editor.fields.connection.title')"
			:error="errorText('to')"
			data-test-field="to"
		>
			<automation-option-select
				:model-value="props.config.to"
				:options="connections"
				:empty-label="t('automations.editor.options.connections.any')"
				:disabled="props.disabled"
				name="to"
				@update:model-value="(to: string | undefined): void => form.update({ to }, 'to')"
			/>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Device goes offline or online": the device watched, and whether to start when it goes offline, when it
 * comes back online, or both.
 */
import { computed, onBeforeMount } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElOption, ElSelect } from 'element-plus';

import { useDevices } from '../../../devices/composables/useDevices';
import type { IDevice } from '../../../devices/store/devices.store.types';
import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { AUTOMATION_DEVICE_CONNECTIONS } from '../../nodes/nodes.constants';
import { DeviceConnectionChangedConfigSchema } from '../../nodes/nodes.schemas';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import type { IAutomationOption } from './automation-option-select.types';
import AutomationOptionSelect from './automation-option-select.vue';

defineOptions({
	name: 'AutomationDeviceConnectionChangedForm',
});

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, DeviceConnectionChangedConfigSchema);

const { errorText } = form;

const { devices, areLoading } = useDevices();

const { ensureDevices } = useAutomationNodeLookups();

const sortedDevices = computed<IDevice[]>((): IDevice[] => [...devices.value].sort((a, b) => a.name.localeCompare(b.name)));

const connections = computed<IAutomationOption[]>((): IAutomationOption[] =>
	AUTOMATION_DEVICE_CONNECTIONS.map((connection) => ({ value: connection, label: t(`automations.editor.options.connections.${connection}`) }))
);

onBeforeMount((): void => {
	void ensureDevices();
});
</script>
