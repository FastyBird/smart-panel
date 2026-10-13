<template>
	<el-card
		shadow="never"
		data-test-id="measurement-editor"
	>
		<template #header>
			<strong>{{ t(`devicesVirtualPlugin.measurement.${isTransform ? 'transform' : 'aggregate'}`) }}</strong>
		</template>
		<el-alert
			v-if="error || catalogError"
			:title="message(error ?? catalogError)"
			type="error"
			:closable="false"
			class="mb-3"
		/>
		<el-button
			v-if="conflict || catalogError"
			:disabled="busy"
			@click="reload"
		>
			{{ t('devicesVirtualPlugin.measurement.reload') }}
		</el-button>
		<el-alert
			v-if="current"
			:title="
				t('devicesVirtualPlugin.measurement.quality', {
					quality: diagnosticLabel('quality' in current ? current.quality : current.runtime_readiness),
				})
			"
			type="info"
			:closable="false"
			class="mb-3"
		/>
		<el-form
			label-position="top"
			:disabled="busy || loading"
		>
			<el-form-item
				v-if="!outputId"
				:label="t('devicesVirtualPlugin.measurement.name')"
			>
				<el-input v-model="model.name" />
			</el-form-item>
			<el-form-item
				v-if="isTransform"
				:label="t('devicesVirtualPlugin.measurement.profile')"
			>
				<el-select
					v-model="model.temperature"
					:disabled="!!outputId"
				>
					<el-option
						:value="true"
						:label="t('devicesVirtualPlugin.measurement.temperature')"
					/>
					<el-option
						:value="false"
						:label="t('devicesVirtualPlugin.measurement.generic')"
					/>
				</el-select>
			</el-form-item>
			<div
				v-if="isTransform && !model.temperature"
				class="grid grid-cols-2 gap-3"
			>
				<el-form-item :label="t('devicesVirtualPlugin.measurement.quantity')">
					<el-input
						v-model="model.quantity"
						:disabled="current !== null"
					/>
				</el-form-item>
				<el-form-item :label="t('devicesVirtualPlugin.measurement.unit')">
					<el-input
						v-model="model.unit"
						:disabled="current !== null"
						:maxlength="32"
					/>
				</el-form-item>
			</div>
			<el-form-item :label="t('devicesVirtualPlugin.measurement.inputs')">
				<div class="w-full space-y-2">
					<div
						v-for="(input, index) in model.inputs"
						:key="input.id ?? index"
						class="flex gap-2 items-center"
					>
						<el-select
							v-model="input.source_property"
							filterable
							class="grow-1"
							:placeholder="t('devicesVirtualPlugin.measurement.selectSource')"
						>
							<el-option
								v-if="input.source_property && !candidates.some((candidate) => candidate.id === input.source_property)"
								:value="input.source_property"
								disabled
								:label="t('devicesVirtualPlugin.measurement.missing', { id: input.identity ?? input.source_property })"
							/>
							<el-option
								v-if="input.source_property === null"
								:value="''"
								disabled
								:label="t('devicesVirtualPlugin.measurement.missing', { id: input.identity })"
							/>
							<el-option
								v-for="candidate in availableCandidates(index)"
								:key="candidate.id"
								:value="candidate.id"
								:label="`${candidate.label} (${candidate.unit})`"
							/>
						</el-select>
						<el-tag
							v-if="input.source_property === null"
							type="warning"
						>
							{{ t('devicesVirtualPlugin.measurement.missing', { id: input.identity }) }}
						</el-tag>
						<el-button
							v-if="!isTransform"
							@click="model.inputs.splice(index, 1)"
						>
							{{ t('devicesVirtualPlugin.measurement.remove') }}
						</el-button>
					</div>
					<el-button
						v-if="!isTransform"
						@click="model.inputs.push({ source_property: null })"
					>
						{{ t('devicesVirtualPlugin.measurement.addInput') }}
					</el-button>
				</div>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.measurement.operator')">
				<el-select
					v-if="isTransform"
					v-model="model.operator"
				>
					<el-option
						v-for="operator in transformOperators"
						:key="operator"
						:value="operator"
						:label="t(`devicesVirtualPlugin.measurement.operators.${operator}`)"
						:disabled="[TransformOperator.ntc_beta, TransformOperator.steinhart_hart].includes(operator) && !thermistorAllowed"
					/>
				</el-select>
				<el-select
					v-else
					v-model="model.aggregateOperator"
				>
					<el-option
						v-for="operator in aggregateOperators"
						:key="operator"
						:value="operator"
						:label="t(`devicesVirtualPlugin.measurement.operators.${operator}`)"
					/>
				</el-select>
			</el-form-item>
			<el-alert
				v-if="isTransform"
				:title="t('devicesVirtualPlugin.measurement.nativeCelsius')"
				type="info"
				:closable="false"
				class="mb-3"
			/>
			<el-form-item
				v-if="!isTransform"
				:label="t('devicesVirtualPlugin.measurement.quorum')"
			>
				<el-input-number
					v-model="model.minimumValidInputs"
					:min="1"
					:max="model.inputs.length || 1"
					:precision="0"
				/>
			</el-form-item>
			<el-form-item :label="t('devicesVirtualPlugin.measurement.maximumAge')">
				<el-input-number
					v-model="model.maximumAgeSeconds"
					:min="1"
					:max="86400"
					:precision="0"
				/>
			</el-form-item>
			<template v-if="isTransform">
				<div class="grid grid-cols-2 gap-3">
					<el-form-item
						v-for="field in rangeFields"
						:key="field"
						:label="t(`devicesVirtualPlugin.measurement.${field}`)"
					>
						<el-input-number v-model="model[field]" />
					</el-form-item>
				</div>
				<div
					v-if="model.operator === TransformOperator.affine"
					class="grid grid-cols-2 gap-3"
				>
					<el-form-item
						v-for="field in affineFields"
						:key="field"
						:label="t(`devicesVirtualPlugin.measurement.${field}`)"
					>
						<el-input-number v-model="model[field]" />
					</el-form-item>
				</div>
				<div
					v-if="model.operator === TransformOperator.piecewise_linear"
					class="mb-3"
				>
					<div
						v-for="(point, index) in model.points"
						:key="index"
						class="flex gap-2 mb-2"
					>
						<el-input-number
							v-model="point.x"
							aria-label="X"
						/>
						<el-input-number
							v-model="point.y"
							aria-label="Y"
						/>
						<el-button @click="model.points.splice(index, 1)">{{ t('devicesVirtualPlugin.measurement.remove') }}</el-button>
					</div>
					<el-button @click="model.points.push({ x: 0, y: 0 })">{{ t('devicesVirtualPlugin.measurement.addPoint') }}</el-button>
				</div>
				<template v-if="model.operator === TransformOperator.ntc_beta || model.operator === TransformOperator.steinhart_hart">
					<div class="grid grid-cols-2 gap-3">
						<el-form-item
							v-for="field in model.operator === TransformOperator.ntc_beta ? ntcFields : steinhartFields"
							:key="field"
							:label="t(`devicesVirtualPlugin.measurement.${field}`)"
						>
							<el-input-number v-model="model[field]" />
						</el-form-item>
					</div>
					<el-form-item :label="t('devicesVirtualPlugin.measurement.divider')">
						<el-select v-model="model.thermistorLeg">
							<el-option
								:value="Divider.low"
								:label="t('devicesVirtualPlugin.measurement.low')"
							/>
							<el-option
								:value="Divider.high"
								:label="t('devicesVirtualPlugin.measurement.high')"
							/>
						</el-select>
					</el-form-item>
				</template>
				<el-form-item :label="t('devicesVirtualPlugin.measurement.sample')"><el-input-number v-model="model.previewInput" /></el-form-item>
			</template>
		</el-form>
		<div
			v-if="preview"
			class="mb-3"
			data-test-id="measurement-preview"
		>
			<el-alert
				:title="t('devicesVirtualPlugin.measurement.previewOnly')"
				type="info"
				:closable="false"
			/>
			<template v-if="'preview_result' in preview && preview.preview_result">
				<p>{{ preview.preview_result.input }} → {{ preview.preview_result.value ?? '—' }} {{ 'unit' in preview ? preview.unit : '' }}</p>
				<el-text type="danger">{{ diagnosticLabel(preview.preview_result.error) }}</el-text>
			</template>
			<template v-if="'inputs' in preview">
				<div
					v-for="input in preview.inputs"
					:key="input.id"
				>
					<code>{{ input.source_identity }}</code>
					· {{ diagnosticLabel(input.exclusion) }}
				</div>
			</template>
		</div>
		<div
			v-if="current && 'source' in current"
			class="mb-3"
		>
			<p>{{ current.source.current_value ?? '—' }} {{ current.source.unit }} → {{ current.current_value ?? '—' }} {{ current.unit }}</p>
			<el-text type="warning">{{ current.errors.map(diagnosticLabel).join(', ') }}</el-text>
		</div>
		<div
			v-if="current && 'inputs' in current"
			class="mb-3"
		>
			<div
				v-for="input in current.inputs"
				:key="input.id"
			>
				<code>{{ input.source_identity }}</code>
				· {{ diagnosticLabel(input.exclusion) }}
			</div>
		</div>
		<el-button
			:loading="busy"
			:disabled="!canPreview || loading || !!catalogError || (!outputId && !model.name.trim())"
			@click="previewDraft"
		>
			{{ t('devicesVirtualPlugin.measurement.preview') }}
		</el-button>
		<el-button
			type="primary"
			:loading="busy"
			:disabled="!preview || loading || !!catalogError"
			@click="submit"
		>
			{{ t(`devicesVirtualPlugin.measurement.${outputId ? 'save' : 'create'}`) }}
		</el-button>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElTag, ElText } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesVirtualPluginConfigureAggregateOperator as AggregateOperator,
	DevicesVirtualPluginNumericTransformPolicyOperator as TransformOperator,
} from '../../../openapi';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { useMeasurementAuthoring } from '../composables/use-measurement-authoring';
import { type MeasurementMode, measurementCandidates } from '../utils/measurement-authoring.utils';

const props = defineProps<{ mode: MeasurementMode; outputId?: string; temperature?: boolean }>();
const emit = defineEmits<{ created: [deviceId: string] }>();
const { t, te } = useI18n();
const stores = injectStoresManager(),
	devices = stores.getStore(devicesStoreKey),
	channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const { model, busy, error, conflict, current, preview, isTransform, canPreview, load, previewDraft, save } = useMeasurementAuthoring(
	props.mode,
	props.outputId
);
model.temperature = props.temperature ?? true;
if (isTransform) model.inputs = [{ source_property: null }];
const loading = ref(false),
	catalogError = ref<string | null>(null);
const candidates = computed(() => measurementCandidates(props.mode, devices.findAll(), channels.findAll(), properties.findAll()));
const availableCandidates = (index: number) =>
	candidates.value.filter((candidate) => !model.inputs.some((input, other) => other !== index && input.source_property === candidate.id));
const thermistorAllowed = computed(
	() =>
		model.temperature &&
		candidates.value.some(
			(candidate) => candidate.id === model.inputs[0]?.source_property && candidate.quantity === 'voltage' && candidate.unit === 'V'
		)
);
const Divider = { low: 'low', high: 'high' } as const;
const rangeFields = ['inputMinimum', 'inputMaximum', 'outputMinimum', 'outputMaximum'] as const;
const affineFields = ['scale', 'offset'] as const;
const ntcFields = ['referenceVoltage', 'seriesResistance', 'nominalResistance', 'nominalTemperatureCelsius', 'beta'] as const;
const steinhartFields = ['referenceVoltage', 'seriesResistance', 'coefficientA', 'coefficientB', 'coefficientC'] as const;
const transformOperators = Object.values(TransformOperator),
	aggregateOperators = Object.values(AggregateOperator);
const message = (key: string | null) => (key?.startsWith('measurement') ? t(`devicesVirtualPlugin.measurement.${key}`) : (key ?? ''));
const diagnosticLabel = (value: string | null | undefined): string => {
	if (!value) return '—';
	const [code, identity] = value.split(':', 2);
	const key = `devicesVirtualPlugin.measurement.states.${code}`;
	return te(key) ? `${t(key)}${identity ? ` · ${identity}` : ''}` : `${t('devicesVirtualPlugin.measurement.states.unknown')} (${value})`;
};
watch(
	model,
	() => {
		preview.value = null;
	},
	{ deep: true }
);
const reload = async () => {
	loading.value = true;
	catalogError.value = null;
	try {
		await devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
		await channels.fetch({});
		for (const channel of channels.findAll()) await properties.fetch({ channelId: channel.id });
		await load();
	} catch {
		catalogError.value = 'measurementCatalog';
	} finally {
		loading.value = false;
	}
};
const submit = async () => {
	const deviceId = await save();
	if (deviceId) emit('created', deviceId);
};
onMounted(reload);
</script>
