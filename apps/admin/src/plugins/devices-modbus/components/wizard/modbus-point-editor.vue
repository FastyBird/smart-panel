<template>
	<el-dialog
		:model-value="visible"
		:title="t('devicesModbusPlugin.wizard.points.editor.title')"
		width="720px"
		align-center
		@update:model-value="onVisibleChange"
	>
		<el-form
			v-if="draft"
			label-position="top"
			@submit.prevent
		>
			<div class="flex flex-wrap gap-4">
				<el-form-item
					:label="t('devicesModbusPlugin.wizard.points.columns.name')"
					class="grow-1"
				>
					<el-input
						v-model="draft.name"
						name="pointName"
					/>
				</el-form-item>

				<el-form-item
					v-if="pointKind === 'number'"
					:label="t('devicesModbusPlugin.wizard.points.columns.unit')"
				>
					<el-input
						:model-value="draft.unit ?? ''"
						class="w-[100px]!"
						name="pointUnit"
						@update:model-value="(value: string) => (draft!.unit = value.trim() === '' ? null : value)"
					/>
				</el-form-item>

				<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.capability')">
					<el-select
						:model-value="capabilityKeyOf(draft)"
						:disabled="!capabilityEditable"
						class="w-[200px]!"
						@update:model-value="onCapabilityChange"
					>
						<el-option
							v-for="option in capabilityOptions"
							:key="option"
							:label="capabilityLabel(option)"
							:value="option"
						/>
					</el-select>
				</el-form-item>
			</div>

			<div
				v-for="section in sections"
				:key="section.kind"
				class="mb-4"
			>
				<div class="font-bold mb-2">
					{{ t(`devicesModbusPlugin.wizard.points.editor.${section.kind}Binding`) }}
				</div>

				<div class="flex flex-wrap gap-4">
					<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.registerType')">
						<el-select
							:model-value="section.binding.registerType"
							class="w-[180px]!"
							@update:model-value="(type: DevicesModbusPluginRegisterType) => onRegisterTypeChange(section.kind, type)"
						>
							<el-option
								v-for="type in registerTypeOptions(section.kind)"
								:key="type"
								:label="t(`devicesModbusPlugin.wizard.probe.registerType.${type}`)"
								:value="type"
							/>
						</el-select>
					</el-form-item>

					<el-form-item
						:label="t('devicesModbusPlugin.wizard.points.columns.address')"
						:error="addressError(section.kind) ?? undefined"
					>
						<el-input
							v-model="addressTexts[section.kind]"
							class="w-[140px]!"
							:name="`${section.kind}Address`"
						/>
						<div
							v-if="addressError(section.kind) === null"
							class="text-xs w-full mt-1"
						>
							{{ t('devicesModbusPlugin.wizard.points.pduAddress', { address: parsedAddress(section.kind)?.start }) }}
						</div>
					</el-form-item>

					<el-form-item
						:label="t('devicesModbusPlugin.wizard.points.columns.dataType')"
						:error="issueOf(section.kind, 'dataType')"
					>
						<el-select
							v-model="section.binding.dataType"
							class="w-[120px]!"
						>
							<el-option
								v-for="type in dataTypeOptions(section.binding)"
								:key="type"
								:label="type"
								:value="type"
							/>
						</el-select>
					</el-form-item>

					<el-form-item
						v-if="section.kind === 'read' && showBit(section.binding)"
						:label="t('devicesModbusPlugin.wizard.points.columns.bit')"
						:error="issueOf(section.kind, 'bit')"
					>
						<el-input-number
							v-model="section.binding.bit"
							:min="0"
							:max="15"
							:step="1"
							:precision="0"
							:value-on-clear="null"
							controls-position="right"
						/>
					</el-form-item>
				</div>

				<div class="flex flex-wrap gap-4">
					<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.byteOrder')">
						<el-select
							:model-value="section.binding.byteOrder ?? DEVICE_ORDER"
							class="w-[160px]!"
							@update:model-value="(value: string) => (section.binding.byteOrder = toOrder(value))"
						>
							<el-option
								v-for="order in orderOptions"
								:key="order"
								:label="order === DEVICE_ORDER ? t('devicesModbusPlugin.wizard.points.editor.deviceOrder') : order"
								:value="order"
							/>
						</el-select>
					</el-form-item>

					<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.wordOrder')">
						<el-select
							:model-value="section.binding.wordOrder ?? DEVICE_ORDER"
							class="w-[160px]!"
							@update:model-value="(value: string) => (section.binding.wordOrder = toOrder(value))"
						>
							<el-option
								v-for="order in orderOptions"
								:key="order"
								:label="order === DEVICE_ORDER ? t('devicesModbusPlugin.wizard.points.editor.deviceOrder') : order"
								:value="order"
							/>
						</el-select>
					</el-form-item>

					<template v-if="!hasValueMap(section.binding) || section.binding.scale !== 1 || section.binding.offset !== 0">
						<el-form-item
							:label="t('devicesModbusPlugin.wizard.points.columns.scale')"
							:error="issueOf(section.kind, 'scale')"
						>
							<el-input-number
								v-model="section.binding.scale"
								:step="0.1"
								controls-position="right"
							/>
						</el-form-item>

						<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.offset')">
							<el-input-number
								v-model="section.binding.offset"
								:step="0.1"
								controls-position="right"
							/>
						</el-form-item>
					</template>

					<el-form-item
						v-if="pointKind === 'button' && section.kind === 'read'"
						:label="t('devicesModbusPlugin.wizard.points.columns.longPressMs')"
						:error="issueOf(section.kind, 'longPressMs')"
					>
						<el-input-number
							v-model="section.binding.longPressMs"
							:min="MIN_LONG_PRESS_MS"
							:max="MAX_LONG_PRESS_MS"
							:step="100"
							:precision="0"
							:value-on-clear="null"
							placeholder="800"
							controls-position="right"
						/>
					</el-form-item>

					<el-form-item
						:label="t('devicesModbusPlugin.wizard.points.columns.invert')"
						:error="issueOf(section.kind, 'invert')"
					>
						<el-switch v-model="section.binding.invert" />
					</el-form-item>

					<el-form-item
						v-if="section.kind === 'write'"
						:label="t('devicesModbusPlugin.wizard.points.columns.writeFunction')"
						:error="issueOf(section.kind, 'writeFunction')"
					>
						<el-select
							:model-value="section.binding.writeFunction ?? DEVICE_ORDER"
							class="w-[160px]!"
							@update:model-value="
								(value: string) => (section.binding.writeFunction = value === DEVICE_ORDER ? null : (value as DevicesModbusPluginWriteFunction))
							"
						>
							<el-option
								:label="t('devicesModbusPlugin.wizard.points.editor.defaultFunction')"
								:value="DEVICE_ORDER"
							/>
							<el-option
								v-for="fn in writeFunctionOptions"
								:key="fn"
								:label="fn"
								:value="fn"
							/>
						</el-select>
					</el-form-item>
				</div>

				<el-form-item
					v-if="pointKind !== 'button'"
					:label="t('devicesModbusPlugin.wizard.points.columns.valueMap')"
					:error="issueOf(section.kind, 'valueMap')"
				>
					<div class="flex flex-col gap-1 w-full">
						<div
							v-for="(entry, index) in section.binding.valueMap ?? []"
							:key="index"
							class="flex items-center gap-2"
						>
							<el-input-number
								v-model="entry.raw"
								:aria-label="t('devicesModbusPlugin.wizard.points.editor.raw')"
								controls-position="right"
							/>
							<span>&rarr;</span>
							<el-select
								v-if="draft.dataType === 'bool'"
								v-model="entry.value"
								class="w-[120px]!"
							>
								<el-option
									label="true"
									:value="true"
								/>
								<el-option
									label="false"
									:value="false"
								/>
							</el-select>
							<el-input
								v-else
								:model-value="String(entry.value)"
								class="w-[160px]!"
								@update:model-value="(value: string) => (entry.value = toMapValue(value))"
							/>
							<el-button
								link
								type="danger"
								@click="removeMapEntry(section.binding, index)"
							>
								{{ t('devicesModbusPlugin.wizard.points.editor.removeEntry') }}
							</el-button>
						</div>
						<div>
							<el-button
								size="small"
								@click="addMapEntry(section.binding)"
							>
								{{ t('devicesModbusPlugin.wizard.points.editor.addEntry') }}
							</el-button>
						</div>
					</div>
				</el-form-item>
			</div>
		</el-form>

		<template #footer>
			<el-button @click="onVisibleChange(false)">
				{{ t('devicesModbusPlugin.wizard.points.editor.cancel') }}
			</el-button>
			<el-button
				type="primary"
				:disabled="!canSave"
				data-test-id="point-editor-save"
				@click="onSave"
			>
				{{ t('devicesModbusPlugin.wizard.points.editor.save') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElButton, ElDialog, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch } from 'element-plus';

import {
	DevicesModbusPluginByteOrder,
	DevicesModbusPluginDataType,
	DevicesModbusPluginRegisterType,
	DevicesModbusPluginWriteFunction,
} from '../../../../openapi.constants';
import { type ParsedAddress, formatAddress, parseAddressInput } from '../../lib/address-notation';
import { CUSTOM_CAPABILITIES, applyCapability, capabilityKeyOf, capabilityKindOf } from '../../lib/capabilities';
import {
	MAX_LONG_PRESS_MS,
	MIN_LONG_PRESS_MS,
	type ModbusBindingIssueField,
	type ModbusBindingPointKind,
	type ModbusPoint,
	type ModbusPointBinding,
	bindingIssues,
	valueMapValueFromText,
} from '../../lib/points';

import type { IModbusPointEditorProps } from './modbus-point-editor.types';

defineOptions({
	name: 'ModbusPointEditor',
});

const props = defineProps<IModbusPointEditorProps>();

const emit = defineEmits<{
	(e: 'update:visible', visible: boolean): void;
	(e: 'save', point: ModbusPoint): void;
}>();

type Kind = 'read' | 'write';

const DEVICE_ORDER = 'device';

const { t } = useI18n();

const draft = ref<ModbusPoint | null>(null);
const addressTexts = reactive<Record<Kind, string>>({ read: '', write: '' });

const NUMBER_DATA_TYPES = [
	DevicesModbusPluginDataType.int16,
	DevicesModbusPluginDataType.uint16,
	DevicesModbusPluginDataType.int32,
	DevicesModbusPluginDataType.uint32,
	DevicesModbusPluginDataType.float32,
];

// The data types a binding offers: a number reads a numeric type, a button a bool level; the current one always stays.
const dataTypeOptions = (binding: ModbusPointBinding): DevicesModbusPluginDataType[] => {
	const all = Object.values(DevicesModbusPluginDataType);
	const offered = pointKind.value === 'number' ? NUMBER_DATA_TYPES : pointKind.value === 'button' ? [DevicesModbusPluginDataType.bool] : all;

	return offered.includes(binding.dataType) ? offered : [binding.dataType, ...offered];
};
const orderOptions = [DEVICE_ORDER, ...Object.values(DevicesModbusPluginByteOrder)];
const writeFunctionOptions = Object.values(DevicesModbusPluginWriteFunction);

const capabilityLabel = (key: string): string => {
	const path = `devicesModbusPlugin.wizard.points.capabilities.${key}`;
	const label = t(path);

	return label === path ? key : label;
};

const capabilityOptions = computed<string[]>(() => {
	const keys = CUSTOM_CAPABILITIES.map((capability) => capability.key);

	return draft.value !== null && !keys.includes(capabilityKeyOf(draft.value)) ? [capabilityKeyOf(draft.value), ...keys] : keys;
});

const pointKind = computed<ModbusBindingPointKind | null>(() => (draft.value === null ? null : capabilityKindOf(draft.value)));

const sections = computed<{ kind: Kind; binding: ModbusPointBinding }[]>(() => {
	if (draft.value === null) {
		return [];
	}

	return (['read', 'write'] as const).flatMap((kind) => {
		const binding = draft.value?.[kind] ?? null;

		return binding === null ? [] : [{ kind, binding }];
	});
});

watch(
	() => [props.visible, props.point] as const,
	([visible, point]) => {
		if (!visible || point === null) {
			return;
		}

		// A plain copy: nothing reaches the wizard until Save.
		draft.value = JSON.parse(JSON.stringify(point)) as ModbusPoint;

		for (const kind of ['read', 'write'] as const) {
			const binding = draft.value[kind];

			addressTexts[kind] = binding === null ? '' : formatAddress(binding.address, binding.registerType, props.notation);
		}
	},
	{ immediate: true }
);

const registerTypeOptions = (kind: Kind): DevicesModbusPluginRegisterType[] => {
	if (kind === 'write') {
		return [DevicesModbusPluginRegisterType.coil, DevicesModbusPluginRegisterType.holding_register];
	}

	return pointKind.value === 'number'
		? [DevicesModbusPluginRegisterType.input_register, DevicesModbusPluginRegisterType.holding_register]
		: Object.values(DevicesModbusPluginRegisterType);
};

// In Modicon notation the address prefix names the register table, so the text must follow the selected type, or
// saving would silently restore the type the prefix names.
const onRegisterTypeChange = (kind: Kind, type: DevicesModbusPluginRegisterType): void => {
	const binding = draft.value?.[kind] ?? null;

	if (binding === null) {
		return;
	}

	const { parsed } = parseKind(kind);

	binding.registerType = type;

	// Coils and discrete inputs hold a single bit.
	if (type === DevicesModbusPluginRegisterType.coil || type === DevicesModbusPluginRegisterType.discrete_input) {
		binding.dataType = DevicesModbusPluginDataType.bool;
	}

	if (parsed !== null) {
		addressTexts[kind] = formatAddress(parsed.start, type, props.notation);
	}
};

const parseKind = (kind: Kind): { parsed: ParsedAddress | null; error: string | null } => {
	const binding = draft.value?.[kind] ?? null;

	if (binding === null) {
		return { parsed: null, error: null };
	}

	try {
		const parsed = parseAddressInput(addressTexts[kind], props.notation, binding.registerType);

		if (parsed.count !== 1) {
			return { parsed: null, error: t('devicesModbusPlugin.wizard.points.editor.singleAddress') };
		}

		const registerType = parsed.registerType ?? binding.registerType;

		if (kind === 'write' && !registerTypeOptions('write').includes(registerType)) {
			return { parsed: null, error: t('devicesModbusPlugin.wizard.points.errors.writeRegisterType') };
		}

		return { parsed, error: null };
	} catch (error: unknown) {
		return {
			parsed: null,
			error: t(
				error instanceof Error && error.message.startsWith('devicesModbusPlugin.')
					? error.message
					: 'devicesModbusPlugin.wizard.address.errors.invalid'
			),
		};
	}
};

const parsedAddress = (kind: Kind): ParsedAddress | null => parseKind(kind).parsed;

// The rules the backend checks on Create, applied to the binding as it would be saved (parsed address and table).
const issuesOf = (kind: Kind): Partial<Record<ModbusBindingIssueField, string>> => {
	const binding = draft.value?.[kind] ?? null;

	if (binding === null) {
		return {};
	}

	const parsed = parsedAddress(kind);

	if (parsed === null) {
		// The address field already shows why it does not parse.
		const issues = bindingIssues(binding, kind, pointKind.value);

		delete issues.address;

		return issues;
	}

	const effective = { ...binding, address: parsed.start, registerType: parsed.registerType ?? binding.registerType };

	// Save drops a bit the binding does not show, so it must not narrow the value map either.
	return bindingIssues({ ...effective, bit: kind === 'read' && showBit(effective) ? effective.bit : null }, kind, pointKind.value);
};

const issueOf = (kind: Kind, field: ModbusBindingIssueField): string | undefined => {
	const key = issuesOf(kind)[field];

	return key === undefined ? undefined : t(key);
};

const addressError = (kind: Kind): string | null => parseKind(kind).error ?? issueOf(kind, 'address') ?? null;

const canSave = computed<boolean>(
	() =>
		draft.value !== null &&
		draft.value.name.trim() !== '' &&
		sections.value.every((section) => parseKind(section.kind).error === null && Object.keys(issuesOf(section.kind)).length === 0)
);

const showBit = (binding: ModbusPointBinding): boolean =>
	binding.dataType === DevicesModbusPluginDataType.bool &&
	(binding.registerType === DevicesModbusPluginRegisterType.holding_register ||
		binding.registerType === DevicesModbusPluginRegisterType.input_register);

const hasValueMap = (binding: ModbusPointBinding): boolean => binding.valueMap !== null && binding.valueMap.length > 0;

const toOrder = (value: string): DevicesModbusPluginByteOrder | null => (value === DEVICE_ORDER ? null : (value as DevicesModbusPluginByteOrder));

const toMapValue = (text: string): string | number => valueMapValueFromText(text, draft.value?.dataType ?? '');

const addMapEntry = (binding: ModbusPointBinding): void => {
	binding.valueMap = [...(binding.valueMap ?? []), { raw: 0, value: draft.value?.dataType === 'bool' ? true : '' }];
};

const removeMapEntry = (binding: ModbusPointBinding, index: number): void => {
	const next = (binding.valueMap ?? []).filter((_, position) => position !== index);

	binding.valueMap = next.length > 0 ? next : null;
};

const onCapabilityChange = (key: string): void => {
	const capability = CUSTOM_CAPABILITIES.find((candidate) => candidate.key === key);

	if (!draft.value || !capability) {
		return;
	}

	const had: Record<Kind, boolean> = { read: draft.value.read !== null, write: draft.value.write !== null };
	const before: Record<Kind, { registerType: DevicesModbusPluginRegisterType | null; start: number | null }> = {
		read: { registerType: draft.value.read?.registerType ?? null, start: parsedAddress('read')?.start ?? null },
		write: { registerType: draft.value.write?.registerType ?? null, start: parsedAddress('write')?.start ?? null },
	};

	draft.value = applyCapability(draft.value, capability);

	for (const kind of ['read', 'write'] as const) {
		const binding = draft.value[kind];
		const other: Kind = kind === 'read' ? 'write' : 'read';
		const previous = before[kind];

		if (binding === null) {
			// A removed binding forgets its address, so recreating it later cannot bring back a stale one.
			addressTexts[kind] = '';
		} else if (!had[kind]) {
			// A new binding is a copy of the other one, so it starts at the address typed for that one.
			addressTexts[kind] = had[other] ? addressTexts[other] : formatAddress(binding.address, binding.registerType, props.notation);
		} else if (binding.registerType !== previous.registerType && previous.start !== null) {
			// A new kind can move the binding to another table; in Modicon notation the text names the table.
			addressTexts[kind] = formatAddress(previous.start, binding.registerType, props.notation);
		}
	}
};

const onVisibleChange = (visible: boolean): void => {
	emit('update:visible', visible);
};

const onSave = (): void => {
	if (!draft.value || !canSave.value) {
		return;
	}

	const result = JSON.parse(JSON.stringify(draft.value)) as ModbusPoint;

	for (const kind of ['read', 'write'] as const) {
		const binding = result[kind];
		const parsed = parsedAddress(kind);

		if (binding !== null && parsed !== null) {
			binding.address = parsed.start;
			binding.registerType = parsed.registerType ?? binding.registerType;

			// Bit-in-register bindings are read-only; a write binding copied from a bit read must not keep the bit.
			if (kind === 'write' || !showBit(binding)) {
				binding.bit = null;
			}

			// Only the read binding of a button event holds a long press.
			if (kind === 'write' || pointKind.value !== 'button') {
				binding.longPressMs = null;
			}
		}
	}

	result.name = result.name.trim();

	emit('save', result);
	emit('update:visible', false);
};
</script>
