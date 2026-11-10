<template>
	<el-form
		label-position="top"
		data-test="node-form"
		@submit.prevent
	>
		<template v-if="props.node.type === 'device.property.changed'">
			<el-form-item label="Property">
				<el-select
					:model-value="String(props.node.config.property)"
					data-test="field-property"
					@update:model-value="patch({ property: $event })"
				>
					<el-option
						v-for="(item, key) in PROPERTY_LABELS"
						:key="key"
						:label="item.label"
						:value="key"
					/>
				</el-select>
			</el-form-item>
			<el-form-item label="Becomes">
				<el-select
					:model-value="String(props.node.config.to)"
					data-test="field-to"
					@update:model-value="patch({ to: $event })"
				>
					<el-option
						label="detected"
						value="detected"
					/>
					<el-option
						label="clear"
						value="clear"
					/>
				</el-select>
			</el-form-item>
			<el-form-item label="For (minutes)">
				<el-input-number
					:model-value="Number(props.node.config.for_minutes)"
					:min="0"
					:max="1440"
					data-test="field-for"
					@update:model-value="patch({ for_minutes: $event ?? 0 })"
				/>
			</el-form-item>
		</template>

		<template v-else-if="props.node.type === 'device.property.compare'">
			<el-form-item label="Property">
				<el-select
					:model-value="String(props.node.config.property)"
					data-test="field-property"
					@update:model-value="patch({ property: $event })"
				>
					<el-option
						v-for="(item, key) in PROPERTY_LABELS"
						:key="key"
						:label="item.label"
						:value="key"
					/>
				</el-select>
			</el-form-item>
			<el-form-item label="Operator">
				<el-select
					:model-value="String(props.node.config.operator)"
					data-test="field-operator"
					@update:model-value="patch({ operator: $event })"
				>
					<el-option
						v-for="(label, key) in OPERATOR_LABELS"
						:key="key"
						:label="label"
						:value="key"
					/>
				</el-select>
			</el-form-item>
			<el-form-item label="Value">
				<el-input-number
					:model-value="Number(props.node.config.value)"
					data-test="field-value"
					@update:model-value="patch({ value: $event ?? 0 })"
				/>
			</el-form-item>
		</template>

		<template v-else-if="props.node.type === 'time.window'">
			<el-form-item label="From">
				<el-time-select
					:model-value="String(props.node.config.from)"
					start="00:00"
					step="00:30"
					end="23:30"
					:clearable="false"
					@update:model-value="patch({ from: $event })"
				/>
			</el-form-item>
			<el-form-item label="To">
				<el-time-select
					:model-value="String(props.node.config.to)"
					start="00:00"
					step="00:30"
					end="23:30"
					:clearable="false"
					@update:model-value="patch({ to: $event })"
				/>
			</el-form-item>
		</template>

		<template v-else-if="props.node.type === 'light.set'">
			<el-form-item label="State">
				<el-select
					:model-value="props.node.config.on ? 'on' : 'off'"
					data-test="field-on"
					@update:model-value="patch({ on: $event === 'on' })"
				>
					<el-option
						label="On"
						value="on"
					/>
					<el-option
						label="Off"
						value="off"
					/>
				</el-select>
			</el-form-item>
			<el-form-item
				v-if="props.node.config.on"
				label="Brightness (%)"
			>
				<el-input-number
					:model-value="Number(props.node.config.brightness)"
					:min="1"
					:max="100"
					data-test="field-brightness"
					@update:model-value="patch({ brightness: $event ?? 100 })"
				/>
			</el-form-item>
		</template>

		<template v-else-if="props.node.type === 'flow.delay'">
			<el-form-item label="Seconds">
				<el-input-number
					:model-value="Number(props.node.config.seconds)"
					:min="1"
					:max="86400"
					@update:model-value="patch({ seconds: $event ?? 1 })"
				/>
			</el-form-item>
		</template>
	</el-form>
</template>

<script setup lang="ts">
import { ElForm, ElFormItem, ElInputNumber, ElOption, ElSelect, ElTimeSelect } from 'element-plus';

import { OPERATOR_LABELS, PROPERTY_LABELS } from '../automations-spike.catalogue';
import type { IAutomationGraphNode } from '../automations-spike.types';

defineOptions({
	name: 'AutomationNodeForm',
});

const props = defineProps<{ node: IAutomationGraphNode }>();

const emit = defineEmits<{
	(e: 'update:config', config: Record<string, unknown>): void;
}>();

const patch = (values: Record<string, unknown>): void => {
	emit('update:config', { ...props.node.config, ...values });
};
</script>
