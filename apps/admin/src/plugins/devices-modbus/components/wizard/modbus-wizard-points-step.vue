<template>
	<div class="flex flex-col gap-4">
		<el-alert
			v-if="templateDiffers"
			type="info"
			:closable="false"
			show-icon
			:title="t('devicesModbusPlugin.wizard.points.customNotice')"
			data-test-id="points-custom-notice"
		/>

		<div class="flex flex-wrap items-end gap-4">
			<div>
				<div class="text-sm mb-1">
					{{ t('devicesModbusPlugin.wizard.probe.notation.title') }}
				</div>
				<el-select
					:model-value="wizard.state.notation"
					class="w-[200px]!"
					name="pointsNotation"
					@update:model-value="(value: AddressNotation) => wizard.setNotation(value)"
				>
					<el-option
						v-for="option in notationOptions"
						:key="option.value"
						:label="option.label"
						:value="option.value"
					/>
				</el-select>
			</div>

			<div class="flex items-center gap-2">
				<el-button
					:loading="live.reading.value"
					:disabled="!canRead"
					data-test-id="points-read-now"
					@click="live.readNow()"
				>
					{{ t('devicesModbusPlugin.wizard.points.readNow') }}
				</el-button>
				<el-switch
					v-model="live.autoRefresh.value"
					:disabled="!canRead"
					:active-text="t('devicesModbusPlugin.wizard.points.autoRefresh')"
					data-test-id="points-auto-refresh"
				/>
			</div>
		</div>

		<el-form
			label-position="top"
			class="border border-solid border-[var(--el-border-color)] rounded p-3"
			@submit.prevent="onAdd"
		>
			<div class="font-bold mb-2">
				{{ t('devicesModbusPlugin.wizard.points.add.title') }}
			</div>

			<div class="flex flex-wrap gap-4">
				<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.capability')">
					<el-select
						v-model="addCapabilityKey"
						class="w-[180px]!"
						name="pointsCapability"
					>
						<el-option
							v-for="capability in CUSTOM_CAPABILITIES"
							:key="capability.key"
							:label="capability.key"
							:value="capability.key"
						/>
					</el-select>
				</el-form-item>

				<el-form-item :label="t('devicesModbusPlugin.wizard.points.columns.registerType')">
					<el-select
						v-model="addRegisterType"
						class="w-[180px]!"
						name="pointsRegisterType"
					>
						<el-option
							v-for="type in addRegisterTypes"
							:key="type"
							:label="t(`devicesModbusPlugin.wizard.probe.registerType.${type}`)"
							:value="type"
						/>
					</el-select>
				</el-form-item>

				<el-form-item
					:label="t('devicesModbusPlugin.wizard.points.add.address')"
					:error="addError ?? undefined"
				>
					<el-input
						v-model="addAddress"
						class="w-[180px]!"
						name="pointsAddress"
						:placeholder="t('devicesModbusPlugin.wizard.points.add.placeholder')"
					/>
					<div
						v-if="addPreview"
						class="text-xs mt-1 w-full"
						data-test-id="points-add-preview"
					>
						{{
							t('devicesModbusPlugin.wizard.points.add.preview', {
								count: addPreview.count,
								address: addPreview.start,
								registerType: t(`devicesModbusPlugin.wizard.probe.registerType.${addPreview.registerType}`),
							})
						}}
					</div>
				</el-form-item>

				<el-form-item :label="t('devicesModbusPlugin.wizard.points.add.namePrefix')">
					<el-input
						v-model="addNamePrefix"
						class="w-[160px]!"
						name="pointsNamePrefix"
					/>
				</el-form-item>
			</div>

			<el-button
				type="primary"
				:disabled="addPreview === null"
				data-test-id="points-add"
				@click="onAdd"
			>
				{{ t('devicesModbusPlugin.wizard.points.add.button') }}
			</el-button>
		</el-form>

		<el-alert
			v-if="live.error.value"
			type="error"
			:closable="false"
			show-icon
			:title="t(explainProbeError(live.error.value))"
		>
			<div class="text-xs">
				{{ live.error.value.message }}
			</div>
		</el-alert>

		<el-empty
			v-if="wizard.state.points.length === 0"
			:description="t('devicesModbusPlugin.wizard.points.empty')"
		/>

		<el-alert
			v-else-if="!hasReadBinding"
			type="warning"
			:closable="false"
			show-icon
			:title="t('devicesModbusPlugin.wizard.points.needsRead')"
		/>

		<el-table
			v-if="wizard.state.points.length > 0"
			:data="wizard.state.points"
			row-key="key"
			size="small"
			data-test-id="points-table"
		>
			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.name')"
				min-width="140"
			>
				<template #default="{ row }">
					<span data-test-id="point-name">{{ row.name }}</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.capability')"
				min-width="140"
			>
				<template #default="{ row }">
					{{ capabilityKeyOf(row) }}
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.registerType')"
				min-width="130"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						{{ t(`devicesModbusPlugin.wizard.probe.registerType.${entry.binding.registerType}`) }}
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.address')"
				min-width="150"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
						:data-test-id="`point-address-${entry.kind}`"
					>
						<span class="font-mono">{{ formatAddress(entry.binding.address, entry.binding.registerType, wizard.state.notation) }}</span>
						<span class="text-xs ml-1">{{ t('devicesModbusPlugin.wizard.points.pduAddress', { address: entry.binding.address }) }}</span>
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.dataType')"
				min-width="90"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						{{ entry.binding.dataType }}
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.bit')"
				min-width="60"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						{{ entry.binding.bit ?? '' }}
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.orders')"
				min-width="110"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						{{ entry.binding.byteOrder ?? '-' }} / {{ entry.binding.wordOrder ?? '-' }}
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.scale')"
				min-width="90"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						{{ entry.binding.scale }} / {{ entry.binding.offset }}
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.invert')"
				min-width="70"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						{{ entry.binding.invert ? t('devicesModbusPlugin.wizard.points.yes') : '' }}
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.valueMap')"
				min-width="130"
			>
				<template #default="{ row }">
					<div
						v-for="entry in bindingsOf(row)"
						:key="entry.kind"
					>
						<template v-if="entry.binding.valueMap">
							{{ entry.binding.valueMap.map((item) => `${item.raw}=${item.value}`).join(', ') }}
						</template>
					</div>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.writeFunction')"
				min-width="90"
			>
				<template #default="{ row }">
					{{ row.write ? (row.write.writeFunction ?? t('devicesModbusPlugin.wizard.points.editor.defaultFunction')) : '' }}
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.live')"
				min-width="90"
			>
				<template #default="{ row }">
					<span :data-test-id="`point-live-${row.key}`">{{ liveValueOf(row.key) }}</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.raw')"
				min-width="90"
			>
				<template #default="{ row }">
					<span :data-test-id="`point-raw-${row.key}`">{{ live.results.value[row.key]?.raw?.join(', ') ?? '' }}</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.error')"
				min-width="160"
			>
				<template #default="{ row }">
					<span
						v-if="live.results.value[row.key]?.error"
						class="text-[var(--el-color-danger)]"
					>
						{{ t(explainProbeError(live.results.value[row.key].error!)) }}
					</span>
				</template>
			</el-table-column>

			<el-table-column
				:label="t('devicesModbusPlugin.wizard.points.columns.actions')"
				min-width="220"
			>
				<template #default="{ row }">
					<el-button
						link
						type="primary"
						:data-test-id="`point-edit-${row.key}`"
						@click="onEdit(row)"
					>
						{{ t('devicesModbusPlugin.wizard.points.actions.edit') }}
					</el-button>
					<el-button
						v-if="row.write"
						link
						type="warning"
						:data-test-id="`point-test-write-${row.key}`"
						@click="onOpenTestWrite(row)"
					>
						{{ t('devicesModbusPlugin.wizard.points.actions.testWrite') }}
					</el-button>
					<el-button
						link
						type="danger"
						:data-test-id="`point-delete-${row.key}`"
						@click="onDelete(row)"
					>
						{{ t('devicesModbusPlugin.wizard.points.actions.delete') }}
					</el-button>
				</template>
			</el-table-column>
		</el-table>

		<el-card
			v-if="writePoint"
			shadow="never"
			data-test-id="points-test-write"
		>
			<div class="font-bold mb-1">
				{{ t('devicesModbusPlugin.wizard.points.testWrite.title', { name: writePoint.name }) }}
			</div>
			<div class="text-sm mb-2">
				{{ t('devicesModbusPlugin.wizard.points.testWrite.description') }}
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<el-select
					v-if="writeOptions"
					v-model="writeValue"
					class="w-[160px]!"
					name="testWriteValue"
				>
					<el-option
						v-for="option in writeOptions"
						:key="String(option)"
						:label="String(option)"
						:value="option"
					/>
				</el-select>
				<el-switch
					v-else-if="writePoint.dataType === 'bool'"
					v-model="writeValue"
					:active-text="t('devicesModbusPlugin.wizard.points.testWrite.on')"
					:inactive-text="t('devicesModbusPlugin.wizard.points.testWrite.off')"
					name="testWriteValue"
				/>
				<el-input-number
					v-else
					v-model="writeValue as number"
					controls-position="right"
					name="testWriteValue"
				/>

				<el-button
					type="warning"
					:loading="writing"
					:disabled="wizard.probeTarget() === null || !writeValueValid"
					data-test-id="points-test-write-run"
					@click="onTestWrite"
				>
					{{ t('devicesModbusPlugin.wizard.points.testWrite.run') }}
				</el-button>
				<el-button
					link
					@click="writeKey = null"
				>
					{{ t('devicesModbusPlugin.wizard.points.testWrite.close') }}
				</el-button>
			</div>
		</el-card>

		<modbus-point-editor
			v-model:visible="editorVisible"
			:point="editing"
			:notation="wizard.state.notation"
			:capability-editable="editing !== null && !isTemplateRow(editing)"
			@save="onEditorSave"
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElEmpty,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElMessageBox,
	ElOption,
	ElSelect,
	ElSwitch,
	ElTable,
	ElTableColumn,
} from 'element-plus';

import { useFlashMessage } from '../../../../common';
import { DevicesModbusPluginRegisterType } from '../../../../openapi.constants';
import { useModbusLiveValues } from '../../composables/useModbusLiveValues';
import { type IModbusProbePointsResult, useModbusProbe } from '../../composables/useModbusProbe';
import { type AddressNotation, AddressNotationError, type ParsedAddress, formatAddress, parseAddressInput } from '../../lib/address-notation';
import { CUSTOM_CAPABILITIES, capabilityKeyOf, defaultRegisterTypeFor, pointBaseFor, registerTypesFor } from '../../lib/capabilities';
import { type ModbusPoint, type ModbusPointBinding, pointsFromRange, samePoints } from '../../lib/points';
import { explainProbeError } from '../../lib/probe-messages';

import ModbusPointEditor from './modbus-point-editor.vue';
import type { IModbusWizardPointsStepProps } from './modbus-wizard-points-step.types';

defineOptions({
	name: 'ModbusWizardPointsStep',
});

const props = defineProps<IModbusWizardPointsStepProps>();

// The probe API reads at most this many points in one request.
const MAX_POINTS = 256;

const { t } = useI18n();
const flashMessage = useFlashMessage();
const probe = useModbusProbe();

// The wizard state is reactive and owned by the composable; the step edits it in place.
const state = props.wizard.state;

const notationOptions = computed(() => [
	{ value: 'one_based', label: t('devicesModbusPlugin.wizard.probe.notation.one_based') },
	{ value: 'pdu', label: t('devicesModbusPlugin.wizard.probe.notation.pdu') },
	{ value: 'modicon', label: t('devicesModbusPlugin.wizard.probe.notation.modicon') },
]);

const deviceOrders = (): { byteOrder: typeof state.device.byteOrder; wordOrder: typeof state.device.wordOrder } => ({
	byteOrder: state.device.byteOrder,
	wordOrder: state.device.wordOrder,
});

const readPoints = async (inputs: { key: string; read: ModbusPointBinding }[]): Promise<IModbusProbePointsResult> => {
	const target = props.wizard.probeTarget();

	if (target === null) {
		return { ok: false, points: [], error: { kind: 'request', exceptionCode: null, message: 'No endpoint is selected.' }, durationMs: 0 };
	}

	return probe.readPoints(target, state.unitId, inputs, deviceOrders());
};

const live = useModbusLiveValues(() => state.points, readPoints);

const hasReadBinding = computed<boolean>(() => state.points.some((point) => point.read !== null));

const canRead = computed<boolean>(() => hasReadBinding.value && props.wizard.probeTarget() !== null);

const templateDiffers = computed<boolean>(() => state.template !== null && !samePoints(state.points, state.template.points));

// Template rows are those whose channel and property exist in the applied template; their capability is fixed.
const isTemplateRow = (point: ModbusPoint): boolean =>
	(state.template?.points ?? []).some(
		(candidate) => candidate.channelIdentifier === point.channelIdentifier && candidate.propertyCategory === point.propertyCategory
	);

const bindingsOf = (point: ModbusPoint): { kind: 'read' | 'write'; binding: ModbusPointBinding }[] =>
	[
		{ kind: 'read' as const, binding: point.read },
		{ kind: 'write' as const, binding: point.write },
	].filter((entry): entry is { kind: 'read' | 'write'; binding: ModbusPointBinding } => entry.binding !== null);

const liveValueOf = (key: string): string => {
	const value = live.results.value[key]?.value;

	return value === undefined || value === null ? '' : String(value);
};

// --- Adding rows ---

const addCapabilityKey = ref<string>(CUSTOM_CAPABILITIES[0].key);
const addCapability = computed(() => CUSTOM_CAPABILITIES.find((capability) => capability.key === addCapabilityKey.value) ?? CUSTOM_CAPABILITIES[0]);
const addRegisterType = ref<DevicesModbusPluginRegisterType>(defaultRegisterTypeFor(CUSTOM_CAPABILITIES[0]));
const addAddress = ref<string>('');
const addNamePrefix = ref<string>(t('devicesModbusPlugin.wizard.points.add.defaultPrefix'));

const addRegisterTypes = computed(() => registerTypesFor(addCapability.value));

watch(addCapability, (capability) => {
	if (!registerTypesFor(capability).includes(addRegisterType.value)) {
		addRegisterType.value = defaultRegisterTypeFor(capability);
	}
});

type AddParse = { ok: true; parsed: ParsedAddress; registerType: DevicesModbusPluginRegisterType } | { ok: false; error: string | null };

const addParse = computed<AddParse>(() => {
	if (addAddress.value.trim() === '') {
		return { ok: false, error: null };
	}

	try {
		const parsed = parseAddressInput(addAddress.value, state.notation, addRegisterType.value);
		const registerType = parsed.registerType ?? addRegisterType.value;

		if (!addRegisterTypes.value.includes(registerType)) {
			return { ok: false, error: t('devicesModbusPlugin.wizard.points.errors.registerType') };
		}

		return { ok: true, parsed, registerType };
	} catch (error: unknown) {
		return {
			ok: false,
			error: t(error instanceof AddressNotationError ? error.message : 'devicesModbusPlugin.wizard.address.errors.invalid'),
		};
	}
});

const addError = computed<string | null>(() => {
	if (!addParse.value.ok) {
		return addParse.value.error;
	}

	return state.points.length + addParse.value.parsed.count > MAX_POINTS
		? t('devicesModbusPlugin.wizard.points.errors.tooManyTotal', { max: MAX_POINTS, free: Math.max(0, MAX_POINTS - state.points.length) })
		: null;
});

const addPreview = computed<{ count: number; start: number; registerType: DevicesModbusPluginRegisterType } | null>(() =>
	addParse.value.ok && addError.value === null
		? { count: addParse.value.parsed.count, start: addParse.value.parsed.start, registerType: addParse.value.registerType }
		: null
);

const takenIdentifiers = (): string[] => [
	...state.points.map((point) => point.channelIdentifier),
	...(state.template?.points ?? []).map((point) => point.channelIdentifier),
];

const onAdd = (): void => {
	if (!addParse.value.ok || addError.value !== null) {
		return;
	}

	const { parsed, registerType } = addParse.value;
	const prefix = addNamePrefix.value.trim() === '' ? t('devicesModbusPlugin.wizard.points.add.defaultPrefix') : addNamePrefix.value.trim();

	state.points.push(...pointsFromRange(pointBaseFor(addCapability.value, registerType), { ...parsed, registerType }, prefix, takenIdentifiers()));

	addAddress.value = '';
};

const onDelete = (point: ModbusPoint): void => {
	state.points = state.points.filter((candidate) => candidate.key !== point.key);

	if (writeKey.value === point.key) {
		writeKey.value = null;
	}
};

// --- Editing ---

const editing = ref<ModbusPoint | null>(null);
const editorVisible = ref<boolean>(false);

const onEdit = (point: ModbusPoint): void => {
	editing.value = point;
	editorVisible.value = true;
};

const onEditorSave = (saved: ModbusPoint): void => {
	const original = editing.value;

	state.points = state.points.map((point) => {
		if (point.key === saved.key) {
			return saved;
		}

		// Points of one channel share its name; renaming one renames them all.
		return original !== null && point.channelIdentifier === original.channelIdentifier ? { ...point, name: saved.name } : point;
	});
};

// --- Test write ---

const writeKey = ref<string | null>(null);
const writeValue = ref<string | number | boolean>(false);
const writing = ref<boolean>(false);

const writePoint = computed<ModbusPoint | null>(() => state.points.find((point) => point.key === writeKey.value && point.write !== null) ?? null);

const writeOptions = computed<(string | number | boolean)[] | null>(() => {
	const map = writePoint.value?.write?.valueMap;

	return map && map.length > 0 ? [...new Set(map.map((entry) => entry.value))] : null;
});

// A cleared number input is null/undefined; a value-map binding only accepts a value of its write map.
const writeValueValid = computed<boolean>(() => {
	if (writeOptions.value !== null) {
		return writeOptions.value.includes(writeValue.value);
	}

	if (writePoint.value?.dataType === 'bool') {
		return typeof writeValue.value === 'boolean';
	}

	return typeof writeValue.value === 'number' && Number.isFinite(writeValue.value);
});

const onOpenTestWrite = (point: ModbusPoint): void => {
	writeKey.value = point.key;

	const first = point.write?.valueMap?.[0]?.value;

	writeValue.value = first ?? (point.dataType === 'bool' ? false : 0);
};

const onTestWrite = async (): Promise<void> => {
	const point = writePoint.value;
	const target = props.wizard.probeTarget();

	if (point === null || point.write === null || target === null || writing.value || !writeValueValid.value) {
		return;
	}

	const binding = point.write;
	const value = writeValue.value;
	const deviceName = state.device.name.trim() !== '' ? state.device.name.trim() : t('devicesModbusPlugin.wizard.points.testWrite.newDevice');

	try {
		await ElMessageBox.confirm(
			t('devicesModbusPlugin.wizard.points.testWrite.confirm', {
				device: deviceName,
				unit: state.unitId,
				registerType: t(`devicesModbusPlugin.wizard.probe.registerType.${binding.registerType}`),
				address: binding.address,
				shown: formatAddress(binding.address, binding.registerType, state.notation),
				value: String(value),
			}),
			t('devicesModbusPlugin.wizard.points.testWrite.confirmTitle'),
			{
				confirmButtonText: t('devicesModbusPlugin.wizard.points.testWrite.confirmButton'),
				cancelButtonText: t('devicesModbusPlugin.wizard.points.testWrite.cancelButton'),
				type: 'warning',
			}
		);
	} catch {
		// Cancelled: nothing is sent.
		return;
	}

	writing.value = true;

	try {
		const result = await probe.write(target, state.unitId, binding, value, deviceOrders());

		if (!result.ok) {
			flashMessage.error(result.error ? t(explainProbeError(result.error)) : t('devicesModbusPlugin.wizard.probe.errors.generic'));

			return;
		}

		flashMessage.success(t('devicesModbusPlugin.wizard.points.testWrite.done'));

		await live.readNow();
	} finally {
		writing.value = false;
	}
};
</script>
