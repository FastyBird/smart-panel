<template>
	<el-form
		label-position="top"
		class="automation-node-generic-form"
		data-test-id="automation-node-generic-form"
		@submit.prevent
	>
		<el-text
			v-if="form.empty"
			tag="div"
			type="info"
			size="small"
		>
			{{ t('automations.editor.form.nothingToConfigure') }}
		</el-text>

		<el-form-item
			v-else-if="form.free"
			:label="t('automations.editor.form.configuration')"
			:error="jsonErrors[WHOLE_CONFIG] ? t('automations.editor.form.invalidJson') : undefined"
		>
			<el-input
				:model-value="jsonDrafts[WHOLE_CONFIG]"
				:disabled="props.disabled"
				:rows="8"
				type="textarea"
				name="config"
				spellcheck="false"
				@update:model-value="(value: string): void => onJsonInput(WHOLE_CONFIG, value)"
			/>
		</el-form-item>

		<el-form-item
			v-for="field in form.fields"
			:key="field.key"
			:label="field.label"
			:required="field.required"
			:error="fieldError(field)"
			:data-test-field="field.key"
		>
			<el-input
				v-if="field.control === 'text'"
				:model-value="textValue(field.key)"
				:disabled="props.disabled"
				:name="field.key"
				clearable
				@update:model-value="(value: string): void => onValue(field, value)"
			/>

			<el-input-number
				v-else-if="field.control === 'number'"
				:model-value="numberValue(field.key)"
				:disabled="props.disabled"
				:name="field.key"
				:min="field.min"
				:max="field.max"
				:precision="field.integer ? 0 : undefined"
				:value-on-clear="null"
				controls-position="right"
				class="w-full!"
				@update:model-value="(value: number | null | undefined): void => onValue(field, value)"
			/>

			<el-select
				v-else-if="field.control === 'boolean'"
				:model-value="booleanValue(field.key)"
				:disabled="props.disabled"
				:name="field.key"
				:placeholder="t('automations.editor.form.notSet')"
				:value-on-clear="null"
				clearable
				@update:model-value="(value: boolean | null): void => onValue(field, value)"
			>
				<el-option
					:label="t('automations.editor.form.yes')"
					:value="true"
				/>
				<el-option
					:label="t('automations.editor.form.no')"
					:value="false"
				/>
			</el-select>

			<el-select
				v-else-if="field.control === 'select'"
				:model-value="scalarValue(field.key)"
				:disabled="props.disabled"
				:name="field.key"
				:placeholder="t('automations.editor.form.notSet')"
				:value-on-clear="null"
				clearable
				@update:model-value="(value: AutomationConfigScalar | null): void => onValue(field, value)"
			>
				<el-option
					v-for="option in field.options"
					:key="String(option)"
					:label="String(option)"
					:value="option"
				/>
			</el-select>

			<el-select
				v-else-if="field.control === 'list'"
				:model-value="listValue(field.key)"
				:disabled="props.disabled"
				:name="field.key"
				:placeholder="t('automations.editor.form.notSet')"
				:filterable="!field.options"
				:allow-create="!field.options"
				:default-first-option="!field.options"
				:reserve-keyword="false"
				multiple
				clearable
				@update:model-value="(value: unknown[]): void => onValue(field, normalizeListValue(field, value))"
			>
				<el-option
					v-for="option in field.options ?? listValue(field.key)"
					:key="String(option)"
					:label="String(option)"
					:value="option"
				/>
			</el-select>

			<div
				v-else-if="field.control === 'value'"
				class="flex flex-row gap-2 w-full"
			>
				<el-select
					:model-value="valueTypes[field.key]"
					:disabled="props.disabled"
					:name="`${field.key}-type`"
					:aria-label="t('automations.editor.form.valueType.title')"
					class="w-[110px]! flex-none"
					@update:model-value="(type: ValueType): void => onValueType(field, type)"
				>
					<el-option
						v-for="type in VALUE_TYPES"
						:key="type"
						:label="t(`automations.editor.form.valueType.${type}`)"
						:value="type"
					/>
				</el-select>

				<el-input-number
					v-if="valueTypes[field.key] === 'number'"
					:model-value="numberValue(field.key)"
					:disabled="props.disabled"
					:name="field.key"
					:value-on-clear="null"
					controls-position="right"
					class="grow-1"
					@update:model-value="(value: number | null | undefined): void => onValue(field, value)"
				/>
				<el-select
					v-else-if="valueTypes[field.key] === 'boolean'"
					:model-value="booleanValue(field.key)"
					:disabled="props.disabled"
					:name="field.key"
					:placeholder="t('automations.editor.form.notSet')"
					:value-on-clear="null"
					clearable
					class="grow-1"
					@update:model-value="(value: boolean | null): void => onValue(field, value)"
				>
					<el-option
						:label="t('automations.editor.form.yes')"
						:value="true"
					/>
					<el-option
						:label="t('automations.editor.form.no')"
						:value="false"
					/>
				</el-select>
				<el-input
					v-else
					:model-value="textValue(field.key)"
					:disabled="props.disabled"
					:name="field.key"
					clearable
					class="grow-1"
					@update:model-value="(value: string): void => onValue(field, value)"
				/>
			</div>

			<el-input
				v-else
				:model-value="jsonDrafts[field.key]"
				:disabled="props.disabled"
				:name="field.key"
				:rows="5"
				type="textarea"
				spellcheck="false"
				@update:model-value="(value: string): void => onJsonInput(field.key, value)"
			/>

			<el-text
				v-if="field.description"
				tag="div"
				size="small"
				type="info"
				class="leading-4! mt-1"
			>
				{{ field.description }}
			</el-text>
		</el-form-item>
	</el-form>
</template>

<script setup lang="ts">
/*
 * The form of a card that has no admin element of its own: generated from the JSON Schema of its
 * configuration (`config_schema` of `GET /node-types`). Field names and hints are the schema's own, in the
 * backend's English - a card that wants better brings its own form (AU-11).
 */
import { computed, reactive, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElText } from 'element-plus';

import {
	type AutomationConfigScalar,
	type IAutomationConfigField,
	type IAutomationConfigForm,
	describeConfigSchema,
	normalizeListValue,
	setConfigValue,
} from '../../automations.config-schema';

import type { IAutomationNodeFormProps } from './automation-node-form.types';

defineOptions({
	name: 'AutomationNodeGenericForm',
});

type ValueType = 'string' | 'number' | 'boolean';

const VALUE_TYPES: ValueType[] = ['string', 'number', 'boolean'];

// The key the draft of a configuration edited as a whole is kept under
const WHOLE_CONFIG = '';

const props = withDefaults(defineProps<IAutomationNodeFormProps>(), {
	fieldErrors: () => ({}),
	disabled: false,
});

const emit = defineEmits<{
	// `field` names what was edited, so a run of keystrokes in one field can be undone as one step
	(e: 'update:config', config: Record<string, unknown>, field: string): void;
}>();

const { t } = useI18n();

const form = computed<IAutomationConfigForm>((): IAutomationConfigForm => describeConfigSchema(props.nodeType.configSchema));

const jsonFields = computed<string[]>((): string[] =>
	form.value.free ? [WHOLE_CONFIG] : form.value.fields.filter((field) => field.control === 'json').map((field) => field.key)
);

/*
 * JSON fields are typed as text and only reach the configuration while they parse; until then the text
 * is kept here and the field says it is not valid.
 */
const jsonDrafts = reactive<Record<string, string>>({});
const jsonErrors = reactive<Record<string, boolean>>({});

const jsonSource = (key: string): unknown => (key === WHOLE_CONFIG ? props.config : props.config[key]);

const toJson = (value: unknown): string => (typeof value === 'undefined' ? '' : JSON.stringify(value, null, 2));

const parseJson = (text: string): { ok: true; value: unknown } | { ok: false } => {
	if (text.trim() === '') {
		return { ok: true, value: undefined };
	}

	try {
		return { ok: true, value: JSON.parse(text) as unknown };
	} catch {
		return { ok: false };
	}
};

watch(
	[jsonFields, (): Record<string, unknown> => props.config],
	(): void => {
		for (const key of jsonFields.value) {
			const draft = typeof jsonDrafts[key] === 'string' ? parseJson(jsonDrafts[key]) : null;

			// The text is replaced only when the configuration was changed from outside (undo, a reload):
			// rewriting it while it is being typed would move the cursor and undo the formatting
			if (draft === null || (draft.ok && JSON.stringify(draft.value) !== JSON.stringify(jsonSource(key)))) {
				jsonDrafts[key] = toJson(jsonSource(key));
				jsonErrors[key] = false;
			}
		}
	},
	{ immediate: true, deep: true }
);

const onJsonInput = (key: string, text: string): void => {
	jsonDrafts[key] = text;

	const parsed = parseJson(text);

	if (!parsed.ok) {
		jsonErrors[key] = true;

		return;
	}

	if (key === WHOLE_CONFIG) {
		const isObject = typeof parsed.value === 'object' && parsed.value !== null && !Array.isArray(parsed.value);

		// A configuration is always an object; an emptied field is an empty one
		if (typeof parsed.value !== 'undefined' && !isObject) {
			jsonErrors[key] = true;

			return;
		}

		jsonErrors[key] = false;

		emit('update:config', (parsed.value ?? {}) as Record<string, unknown>, key);

		return;
	}

	jsonErrors[key] = false;

	emit('update:config', setConfigValue(props.config, key, parsed.value), key);
};

/*
 * A value that may be text, a number or yes/no: its type is chosen next to it. The choice is remembered
 * here, because an empty value has no type to read it from.
 */
const valueTypes = reactive<Record<string, ValueType>>({});

watch(
	[form, (): Record<string, unknown> => props.config],
	(): void => {
		for (const field of form.value.fields) {
			if (field.control !== 'value') {
				continue;
			}

			const value = props.config[field.key];

			if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
				valueTypes[field.key] = typeof value as ValueType;
			} else if (typeof valueTypes[field.key] === 'undefined') {
				valueTypes[field.key] = 'string';
			}
		}
	},
	{ immediate: true, deep: true }
);

const textValue = (key: string): string => {
	const value = props.config[key];

	return typeof value === 'string' ? value : typeof value === 'number' || typeof value === 'boolean' ? String(value) : '';
};

const numberValue = (key: string): number | undefined => {
	const value = props.config[key];

	return typeof value === 'number' ? value : undefined;
};

const booleanValue = (key: string): boolean | null => {
	const value = props.config[key];

	return typeof value === 'boolean' ? value : null;
};

const scalarValue = (key: string): AutomationConfigScalar | null => {
	const value = props.config[key];

	return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : null;
};

const listValue = (key: string): AutomationConfigScalar[] => {
	const value = props.config[key];

	return Array.isArray(value)
		? value.filter((item): item is AutomationConfigScalar => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
		: [];
};

const onValue = (field: IAutomationConfigField, value: unknown): void => {
	emit('update:config', setConfigValue(props.config, field.key, value), field.key);
};

const onValueType = (field: IAutomationConfigField, type: ValueType): void => {
	const current = props.config[field.key];

	valueTypes[field.key] = type;

	// What was entered is carried over where it can be read as the new type, and dropped where it cannot
	let next: unknown = undefined;

	if (type === 'string' && (typeof current === 'number' || typeof current === 'boolean')) {
		next = String(current);
	} else if (type === 'number' && typeof current === 'string' && current.trim() !== '' && Number.isFinite(Number(current))) {
		next = Number(current);
	} else if (type === 'boolean' && (current === 'true' || current === 'false')) {
		next = current === 'true';
	}

	emit('update:config', setConfigValue(props.config, field.key, next), field.key);
};

const fieldError = (field: IAutomationConfigField): string | undefined => {
	if (jsonErrors[field.key]) {
		return t('automations.editor.form.invalidJson');
	}

	const errors = props.fieldErrors[field.key];

	return errors && errors.length > 0 ? errors.join(' ') : undefined;
};
</script>
