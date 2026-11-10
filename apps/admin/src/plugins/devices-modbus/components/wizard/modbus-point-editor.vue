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
							:label="option"
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
							v-model="section.binding.registerType"
							class="w-[180px]!"
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

					<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.dataType')">
						<el-select
							v-model="section.binding.dataType"
							class="w-[120px]!"
						>
							<el-option
								v-for="type in dataTypeOptions"
								:key="type"
								:label="type"
								:value="type"
							/>
						</el-select>
					</el-form-item>

					<el-form-item
						v-if="showBit(section.binding)"
						:label="t('devicesModbusPlugin.wizard.points.columns.bit')"
					>
						<el-input-number
							v-model="section.binding.bit"
							:min="0"
							:max="15"
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

					<template v-if="!hasValueMap(section.binding)">
						<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.scale')">
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

					<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.invert')">
						<el-switch v-model="section.binding.invert" />
					</el-form-item>

					<el-form-item
						v-if="section.kind === 'write'"
						:label="t('devicesModbusPlugin.wizard.points.columns.writeFunction')"
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

				<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.valueMap')">
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
import { CUSTOM_CAPABILITIES, applyCapability, capabilityKeyOf } from '../../lib/capabilities';
import type { ModbusPoint, ModbusPointBinding } from '../../lib/points';

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

const dataTypeOptions = Object.values(DevicesModbusPluginDataType);
const orderOptions = [DEVICE_ORDER, ...Object.values(DevicesModbusPluginByteOrder)];
const writeFunctionOptions = Object.values(DevicesModbusPluginWriteFunction);

const capabilityOptions = computed<string[]>(() => {
	const keys = CUSTOM_CAPABILITIES.map((capability) => capability.key);

	return draft.value !== null && !keys.includes(capabilityKeyOf(draft.value)) ? [capabilityKeyOf(draft.value), ...keys] : keys;
});

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

const registerTypeOptions = (kind: Kind): DevicesModbusPluginRegisterType[] =>
	kind === 'write'
		? [DevicesModbusPluginRegisterType.coil, DevicesModbusPluginRegisterType.holding_register]
		: Object.values(DevicesModbusPluginRegisterType);

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

const addressError = (kind: Kind): string | null => parseKind(kind).error;

const canSave = computed<boolean>(
	() => draft.value !== null && draft.value.name.trim() !== '' && sections.value.every((section) => parseKind(section.kind).error === null)
);

const showBit = (binding: ModbusPointBinding): boolean =>
	binding.dataType === DevicesModbusPluginDataType.bool &&
	(binding.registerType === DevicesModbusPluginRegisterType.holding_register ||
		binding.registerType === DevicesModbusPluginRegisterType.input_register);

const hasValueMap = (binding: ModbusPointBinding): boolean => binding.valueMap !== null && binding.valueMap.length > 0;

const toOrder = (value: string): DevicesModbusPluginByteOrder | null => (value === DEVICE_ORDER ? null : (value as DevicesModbusPluginByteOrder));

const toMapValue = (text: string): string | number => (text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text);

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

	draft.value = applyCapability(draft.value, capability);

	// A binding that was just created starts at the address of the one it was copied from.
	for (const kind of ['read', 'write'] as const) {
		const binding = draft.value[kind];

		if (binding !== null && addressTexts[kind] === '') {
			addressTexts[kind] = formatAddress(binding.address, binding.registerType, props.notation);
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

			if (!showBit(binding)) {
				binding.bit = null;
			}
		}
	}

	result.name = result.name.trim();

	emit('save', result);
	emit('update:visible', false);
};
</script>
