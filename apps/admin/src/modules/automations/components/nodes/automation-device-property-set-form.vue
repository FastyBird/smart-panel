<template>
	<el-form
		label-position="top"
		:disabled="props.disabled"
		class="automation-device-property-set-form"
		data-test-id="automation-device-property-set-form"
		@submit.prevent
	>
		<el-text
			v-for="(error, index) in errorsAt('writes').filter((error) => !rowErrors.has(error))"
			:key="index"
			tag="div"
			type="danger"
			size="small"
			class="leading-4! mb-3"
		>
			{{ error }}
		</el-text>

		<div
			v-for="(row, index) in rows"
			:key="index"
			class="automation-device-property-set-form__write"
			:data-test-write="index"
		>
			<div class="flex flex-row items-center mb-2">
				<el-text
					tag="div"
					size="small"
					class="font-600! grow-1"
				>
					{{ t('automations.editor.fields.set.write', { number: index + 1 }) }}
				</el-text>
				<el-button
					v-if="rows.length > 1 && !props.disabled"
					link
					size="small"
					type="danger"
					:aria-label="t('automations.editor.fields.set.remove')"
					data-test-id="remove-write"
					@click="onRemove(index)"
				>
					<template #icon>
						<icon icon="mdi:close" />
					</template>
				</el-button>
			</div>

			<el-alert
				v-for="(refusal, refusalIndex) in form.refusalsAt(`writes.${index}`)"
				:key="`refusal-${refusalIndex}`"
				:title="t('automations.editor.safety.refused')"
				:description="refusal.message"
				type="error"
				:closable="false"
				show-icon
				class="mb-3!"
				data-test-id="write-refused"
			/>

			<el-alert
				v-for="(warning, warningIndex) in form.warningsAt(`writes.${index}`)"
				:key="`warning-${warningIndex}`"
				:title="issueText(warning)"
				type="warning"
				:closable="false"
				show-icon
				class="mb-3!"
				data-test-id="write-warning"
			/>

			<automation-node-target
				:device-id="text(row.device_id)"
				:channel-id="text(row.channel_id)"
				:property-id="text(row.property_id)"
				:prefix="`writes.${index}.`"
				access="writable"
				:errors="[...errorsAt(`writes.${index}.device_id`), ...errorsAt(`writes.${index}.channel_id`), ...errorsAt(`writes.${index}.property_id`)]"
				@change="(patch: Record<string, unknown>, field: string): void => onTarget(index, patch, field)"
			/>

			<el-form-item
				:label="t('automations.editor.fields.set.value')"
				:error="errorText(`writes.${index}.value`)"
				required
				:data-test-field="`writes.${index}.value`"
			>
				<automation-property-value-input
					:model-value="isPropertyValue(row.value) ? row.value : undefined"
					:property="propertyOf(row)"
					:safety-target="safetyTargetOfRow(row)"
					:disabled="props.disabled"
					:name="`writes.${index}.value`"
					@update:model-value="(value: AutomationPropertyValue | undefined): void => onRow(index, { value }, `writes.${index}.value`)"
				/>
			</el-form-item>
		</div>

		<el-button
			v-if="!props.disabled"
			:disabled="rows.length >= AUTOMATION_SET_MAX_WRITES"
			size="small"
			data-test-id="add-write"
			@click="onAdd"
		>
			<template #icon>
				<icon icon="mdi:plus" />
			</template>
			{{ t('automations.editor.fields.set.add') }}
		</el-button>
	</el-form>
</template>

<script setup lang="ts">
/*
 * "Set device value": up to 20 values, each on its own property. Only writable properties are offered,
 * and for each the values that would unlock, disarm or open are not (design § Security and safety). What
 * the backend refused for safety is shown on the value it is about, as a refusal rather than as a typo.
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElText } from 'element-plus';

import { Icon } from '@iconify/vue';

import { useAutomationNodeForm } from '../../composables/useAutomationNodeForm';
import { useAutomationNodeLookups } from '../../composables/useAutomationNodeLookups';
import { useAutomationNodePresentation } from '../../composables/useAutomationNodePresentation';
import { AUTOMATION_SET_MAX_WRITES } from '../../nodes/nodes.constants';
import { type IAutomationSafetyTarget, safetyTargetOf } from '../../nodes/nodes.safety';
import { DevicePropertySetConfigSchema } from '../../nodes/nodes.schemas';
import type { AutomationLookupProperty } from '../../nodes/nodes.summaries';
import { type AutomationPropertyValue, isPropertyValue, valueFitsProperty } from '../../nodes/nodes.values';
import { type IAutomationNodeFormProps, automationNodeFormEmits } from '../canvas/automation-node-form.types';

import AutomationNodeTarget from './automation-node-target.vue';
import AutomationPropertyValueInput from './automation-property-value-input.vue';

defineOptions({
	name: 'AutomationDevicePropertySetForm',
});

type Row = Record<string, unknown>;

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	issues: () => [],
	disabled: false,
});

const emit = defineEmits(automationNodeFormEmits);

const { t } = useI18n();

const form = useAutomationNodeForm(props, emit, DevicePropertySetConfigSchema);

const { errorsAt, errorText } = form;

const { issueText } = useAutomationNodePresentation();

const lookups = useAutomationNodeLookups();

const text = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

const writes = computed<Row[]>((): Row[] =>
	Array.isArray(props.config.writes) ? props.config.writes.filter((write): write is Row => typeof write === 'object' && write !== null) : []
);

// A row added with "Add value" stays on the form while nothing is picked in it yet
const blankRows = ref<number>(0);

// An action with nothing to set yet still shows the first value to fill in
const rows = computed<Row[]>((): Row[] => {
	const blanks = Math.max(writes.value.length === 0 ? 1 : 0, blankRows.value);

	return [...writes.value, ...Array.from({ length: Math.min(blanks, AUTOMATION_SET_MAX_WRITES - writes.value.length) }, (): Row => ({}))];
});

// The problems shown on a row are not repeated above the rows
const rowErrors = computed<Set<string>>((): Set<string> => new Set(rows.value.flatMap((_row, index) => errorsAt(`writes.${index}`))));

const propertyOf = (row: Row): AutomationLookupProperty | null => {
	const id = text(row.property_id);

	return id === null ? null : lookups.property(id);
};

const safetyTargetOfRow = (row: Row): IAutomationSafetyTarget => {
	const deviceId = text(row.device_id);
	const channelId = text(row.channel_id);

	return safetyTargetOf(deviceId ? lookups.device(deviceId) : null, channelId ? lookups.channel(channelId) : null, propertyOf(row));
};

// An empty text is a value that can be set; an empty id is nothing picked
const withoutEmpty = (row: Row): Row =>
	Object.fromEntries(
		Object.entries(row).filter(([key, value]) => typeof value !== 'undefined' && value !== null && (value !== '' || key === 'value'))
	);

const emitRows = (next: Row[], field: string): void => {
	const kept = next.map(withoutEmpty);
	// Blank rows at the end are the form's own; a blank row in the middle keeps its place
	let end = kept.length;

	while (end > 0 && Object.keys(kept[end - 1] ?? {}).length === 0) end -= 1;

	blankRows.value = kept.length - end;

	form.update({ writes: kept.slice(0, end) }, field);
};

const onRow = (index: number, patch: Row, field: string): void => {
	emitRows(
		rows.value.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
		field
	);
};

const onTarget = (index: number, patch: Row, field: string): void => {
	const row = rows.value[index] ?? {};
	const next = typeof patch.property_id === 'string' ? lookups.property(patch.property_id) : null;

	// A value entered for the old property stays only when the new one can hold it
	const value = typeof row.value !== 'undefined' && valueFitsProperty(row.value, next) ? row.value : undefined;

	onRow(index, { ...patch, value }, `writes.${index}.${field}`);
};

const onAdd = (): void => {
	if (rows.value.length < AUTOMATION_SET_MAX_WRITES) {
		blankRows.value = rows.value.length - writes.value.length + 1;
	}
};

const onRemove = (index: number): void => {
	emitRows(
		rows.value.filter((_row, rowIndex) => rowIndex !== index),
		'writes'
	);
};
</script>

<style scoped lang="scss">
.automation-device-property-set-form {
	&__write {
		padding: 10px 10px 0;
		margin-bottom: 12px;
		border: 1px solid var(--el-border-color-lighter);
		border-radius: var(--el-border-radius-base);
	}
}
</style>
