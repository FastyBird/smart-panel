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
			v-for="({ row, index, malformed }, position) in rows"
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
					{{ t('automations.editor.fields.set.write', { number: position + 1 }) }}
				</el-text>
				<el-button
					v-if="(rows.length > 1 || malformed) && !props.disabled"
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
				v-if="malformed"
				:title="t('automations.editor.fields.set.malformed')"
				type="error"
				:closable="false"
				show-icon
				class="mb-3!"
				data-test-id="write-malformed"
			/>

			<el-text
				v-for="(error, errorIndex) in otherErrorsAt(index)"
				:key="`error-${errorIndex}`"
				tag="div"
				type="danger"
				size="small"
				class="leading-4! mb-3"
				data-test-id="write-errors"
			>
				{{ error }}
			</el-text>

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
			:disabled="full"
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

// A value on the form, at the index it has among the writes configured; an entry there that is not a
// value at all is shown empty, to be removed or replaced by what is picked in it
interface IWriteRow {
	row: Row;
	index: number;
	malformed: boolean;
}

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

const isRow = (write: unknown): write is Row => typeof write === 'object' && write !== null && !Array.isArray(write);

// The writes as configured, an entry that is not one included: what the backend says about a write
// names it by its index there, and an edit keeps the other entries where they are
const writes = computed<unknown[]>((): unknown[] => (Array.isArray(props.config.writes) ? props.config.writes : []));

const given = computed<IWriteRow[]>((): IWriteRow[] =>
	writes.value.map(
		(write: unknown, index: number): IWriteRow => (isRow(write) ? { row: write, index, malformed: false } : { row: {}, index, malformed: true })
	)
);

// A row added with "Add value" stays on the form while nothing is picked in it yet
const blankRows = ref<number>(0);

// An action with nothing to set yet still shows the first value to fill in
const blanks = computed<number>((): number =>
	Math.max(0, Math.min(Math.max(given.value.length === 0 ? 1 : 0, blankRows.value), AUTOMATION_SET_MAX_WRITES - writes.value.length))
);

const rows = computed<IWriteRow[]>((): IWriteRow[] => [
	...given.value,
	...Array.from({ length: blanks.value }, (_blank, offset): IWriteRow => ({ row: {}, index: writes.value.length + offset, malformed: false })),
]);

const full = computed<boolean>((): boolean => writes.value.length + blanks.value >= AUTOMATION_SET_MAX_WRITES);

// The problems shown on a row are not repeated above the rows
const rowErrors = computed<Set<string>>((): Set<string> => new Set(rows.value.flatMap(({ index }) => errorsAt(`writes.${index}`))));

const FIELDS: string[] = ['device_id', 'channel_id', 'property_id', 'value'];

// The problems of a row that none of its fields shows - the entry as a whole, a key it does not take
const otherErrorsAt = (index: number): string[] => {
	const shown = new Set<string>(FIELDS.flatMap((field: string): string[] => errorsAt(`writes.${index}.${field}`)));

	return errorsAt(`writes.${index}`).filter((error: string): boolean => !shown.has(error));
};

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

// The writes with the form's blank rows after them, each at its index
const entries = (): unknown[] => [...writes.value, ...Array.from({ length: blanks.value }, (): Row => ({}))];

const isBlank = (entry: unknown): boolean => isRow(entry) && Object.keys(entry).length === 0;

// `configured` is how many of `next` come from the configuration: only blank rows after those are the
// form's own and stay off it; an empty entry that was configured keeps its place and its errors
const emitRows = (next: unknown[], configured: number, field: string): void => {
	const kept = next.map((entry: unknown): unknown => (isRow(entry) ? withoutEmpty(entry) : entry));
	let end = kept.length;

	while (end > configured && isBlank(kept[end - 1])) end -= 1;

	blankRows.value = kept.length - end;

	form.update({ writes: kept.slice(0, end) }, field);
};

const onRow = (index: number, patch: Row, field: string): void => {
	emitRows(
		entries().map((entry: unknown, entryIndex: number): unknown => (entryIndex === index ? { ...(isRow(entry) ? entry : {}), ...patch } : entry)),
		writes.value.length,
		field
	);
};

const onTarget = (index: number, patch: Row, field: string): void => {
	const row = rows.value.find((item: IWriteRow): boolean => item.index === index)?.row ?? {};
	const next = typeof patch.property_id === 'string' ? lookups.property(patch.property_id) : null;

	// A value entered for the old property stays only when the new one can hold it
	const value = typeof row.value !== 'undefined' && valueFitsProperty(row.value, next) ? row.value : undefined;

	onRow(index, { ...patch, value }, `writes.${index}.${field}`);
};

const onAdd = (): void => {
	if (!full.value) {
		blankRows.value = blanks.value + 1;
	}
};

const onRemove = (index: number): void => {
	emitRows(
		entries().filter((_entry: unknown, entryIndex: number): boolean => entryIndex !== index),
		index < writes.value.length ? writes.value.length - 1 : writes.value.length,
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
