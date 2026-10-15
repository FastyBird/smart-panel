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
					quality: diagnosticLabel(liveQuality),
				})
			"
			type="info"
			:closable="false"
			class="mb-3"
		/>
		<p
			v-if="current && liveReasons.length"
			data-test-id="measurement-reasons"
		>
			{{ liveReasons.map(diagnosticLabel).join(', ') }}
		</p>
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
			<template v-if="!isTransform">
				<el-form-item :label="t('devicesVirtualPlugin.measurement.profile')">
					<el-select
						v-model="model.profile"
						:disabled="!!outputId"
						data-test-id="aggregate-profile"
					>
						<el-option
							v-for="profile in profiles"
							:key="profile.profile"
							:value="profile.profile"
							:label="t(`devicesVirtualPlugin.measurement.profiles.${profile.profile}`)"
						/>
					</el-select>
				</el-form-item>
				<p
					v-if="selectedProfile?.numeric_policy"
					data-test-id="aggregate-grid"
				>
					{{ t('devicesVirtualPlugin.measurement.unit') }}: {{ selectedProfile.unit }} ·
					{{
						effectiveStep === null
							? t('devicesVirtualPlugin.measurement.legacyGrid')
							: t('devicesVirtualPlugin.measurement.grid', { step: effectiveStep, unit: selectedProfile.unit })
					}}
				</p>
				<el-alert
					v-if="sourcesError"
					:title="message(sourcesError)"
					type="error"
					:closable="false"
				/>
			</template>
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
							:loading="sourcesLoading"
							:disabled="!isTransform && (sourcesLoading || !!sourcesError)"
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
							v-if="input.identity"
							:type="input.source_property === null ? 'warning' : 'info'"
						>
							{{ input.source_property === null ? t('devicesVirtualPlugin.measurement.missing', { id: input.identity }) : input.identity }}
						</el-tag>
						<el-form-item
							v-if="!isTransform && numericPolicy && model.aggregateOperator === AggregateOperator.weighted_mean"
							:label="t('devicesVirtualPlugin.measurement.weight')"
							class="mb-0"
						>
							<el-input-number
								v-model="input.weight"
								:min="0.000001"
								:max="1000000"
								:precision="6"
								data-test-id="aggregate-weight"
							/>
						</el-form-item>
						<el-button
							v-if="!isTransform"
							@click="model.inputs.splice(index, 1)"
						>
							{{ t('devicesVirtualPlugin.measurement.remove') }}
						</el-button>
					</div>
					<el-button
						v-if="!isTransform"
						@click="model.inputs.push({ source_property: null, weight: 1 })"
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
						value="extension"
						:label="t('devicesVirtualPlugin.measurement.extensionOperator')"
					/>
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
			<template v-if="!isTransform && numericPolicy">
				<el-form-item :label="t('devicesVirtualPlugin.measurement.filter')">
					<el-switch
						v-model="model.filterEnabled"
						data-test-id="aggregate-filter"
					/>
				</el-form-item>
				<el-form-item
					v-if="model.filterEnabled"
					:label="t('devicesVirtualPlugin.measurement.filterThreshold', { unit: selectedProfile?.unit })"
				>
					<el-input-number
						v-model="model.filterThreshold"
						:min="0.000001"
						data-test-id="aggregate-filter-threshold"
					/>
					<el-text>{{ t('devicesVirtualPlugin.measurement.filterCohort') }}</el-text>
				</el-form-item>
			</template>
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
				<template v-if="model.operator === 'extension'">
					<el-form-item :label="t('devicesVirtualPlugin.measurement.extensionOperator')">
						<el-select
							v-model="model.extensionKey"
							data-test-id="numeric-operator"
							@change="selectOperator"
						>
							<el-option
								v-if="model.extensionKey && !selectedOperator"
								:value="model.extensionKey"
								:label="model.extensionKey"
								disabled
							/>
							<el-option
								v-for="descriptor in numericOperators"
								:key="`${descriptor.operatorId}@${descriptor.operatorVersion}`"
								:value="`${descriptor.operatorId}@${descriptor.operatorVersion}`"
								:label="`${descriptor.operatorId} · v${descriptor.operatorVersion}`"
							/>
						</el-select>
					</el-form-item>
					<el-alert
						v-if="!selectedOperator"
						:title="t('devicesVirtualPlugin.measurement.measurementOperatorMissing')"
						type="warning"
						:closable="false"
					/>
					<template v-else>
						<p data-test-id="numeric-operator-domains">
							{{ selectedOperator.input.quantity }} ({{ selectedOperator.input.unit }}) [{{ selectedOperator.inputRange.minimum }},
							{{ selectedOperator.inputRange.maximum }}] → {{ selectedOperator.output.quantity }} ({{ selectedOperator.output.unit }}) [{{
								selectedOperator.outputRange.minimum
							}}, {{ selectedOperator.outputRange.maximum }}]
						</p>
						<el-form-item
							v-for="(schema, name) in selectedOperator.parameters"
							:key="name"
							:label="String(name)"
							:required="schema.required"
						>
							<el-input-number
								v-model="model.parameters[name]"
								:min="schema.minimum"
								:max="schema.maximum"
								:data-test-id="`numeric-parameter-${name}`"
							/>
						</el-form-item>
					</template>
				</template>
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
				:title="t(`devicesVirtualPlugin.measurement.${isTransform ? 'previewOnly' : 'aggregatePreviewOnly'}`)"
				type="info"
				:closable="false"
			/>
			<template v-if="'preview_result' in preview && preview.preview_result && 'input' in preview.preview_result">
				<p>{{ preview.preview_result.input }} → {{ preview.preview_result.value ?? '—' }} {{ 'unit' in preview ? preview.unit : '' }}</p>
				<el-text type="danger">{{ diagnosticLabel(preview.preview_result.error) }}</el-text>
			</template>
			<template v-if="aggregatePreview">
				<p>{{ t(`devicesVirtualPlugin.measurement.profiles.${aggregatePreview.profile}`) }}</p>
				<p data-test-id="aggregate-preview-result">
					{{ previewValue(aggregatePreview.value, aggregatePreview.output_step) }} {{ aggregatePreview.unit }}
				</p>
				<p data-test-id="aggregate-preview-quality">
					{{ t('devicesVirtualPlugin.measurement.snapshotQuality', { quality: diagnosticLabel(aggregatePreview.quality) }) }}
				</p>
				<p>{{ aggregatePreview.reasons.map(diagnosticLabel).join(', ') }}</p>
				<p>{{ t('devicesVirtualPlugin.measurement.evaluatedAt', { time: aggregatePreview.evaluated_at }) }}</p>
				<p>{{ t('devicesVirtualPlugin.measurement.expiresAt', { time: aggregatePreview.expires_at ?? '—' }) }}</p>
				<div
					v-for="input in aggregatePreview.inputs"
					:key="input.id"
				>
					<code>{{ input.source_identity }}</code>
					· {{ previewValue(input.current_value) }} {{ input.unit }} · {{ diagnosticLabel(input.exclusion) }} ·
					{{ t('devicesVirtualPlugin.measurement.sampleAge', { age: input.age_seconds ?? '—' }) }}
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
				· {{ diagnosticLabel(input.exclusion) }} · {{ t('devicesVirtualPlugin.measurement.sampleAge', { age: input.age_seconds ?? '—' }) }}
			</div>
		</div>
		<el-button
			:loading="busy"
			:disabled="
				!canPreview ||
				loading ||
				!!catalogError ||
				(!isTransform && (!selectedProfile || sourcesLoading || !!sourcesError)) ||
				(!outputId && !model.name.trim())
			"
			@click="previewDraft"
		>
			{{ t('devicesVirtualPlugin.measurement.preview') }}
		</el-button>
		<el-alert
			v-if="previewExpired"
			:title="t('devicesVirtualPlugin.measurement.previewExpired')"
			type="warning"
			:closable="false"
		/>
		<el-button
			type="primary"
			:loading="busy"
			:disabled="!canSavePreview || loading || !!catalogError"
			@click="submit"
		>
			{{ t(`devicesVirtualPlugin.measurement.${outputId ? 'save' : 'create'}`) }}
		</el-button>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect, ElSwitch, ElTag, ElText } from 'element-plus';

import { injectStoresManager } from '../../../common';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import {
	DevicesVirtualPluginConfigureAggregateOperator as AggregateOperator,
	DevicesVirtualPluginNumericTransformPolicyOperator as TransformOperator,
} from '../../../openapi';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { useMeasurementAuthoring } from '../composables/use-measurement-authoring';
import { type MeasurementMode, aggregateCandidates, measurementCandidates } from '../utils/measurement-authoring.utils';

const props = defineProps<{ mode: MeasurementMode; outputId?: string; temperature?: boolean }>();
const emit = defineEmits<{ created: [deviceId: string]; busy: [value: boolean] }>();
const { t, te } = useI18n();
const stores = injectStoresManager(),
	devices = stores.getStore(devicesStoreKey),
	channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const {
	numericOperators,
	selectedOperator,
	selectOperator,
	profiles,
	invalidatePreview,
	previewExpired,
	canSavePreview,
	selectedProfile,
	numericPolicy,
	sources,
	sourcesLoading,
	sourcesError,
	loadCapabilities,
	model,
	busy,
	error,
	conflict,
	current,
	preview,
	isTransform,
	canPreview,
	load,
	previewDraft,
	save,
} = useMeasurementAuthoring(props.mode, props.outputId);
watch(busy, (value) => emit('busy', value), { immediate: true });
model.temperature = props.temperature ?? true;
if (isTransform) model.inputs = [{ source_property: null }];
const loading = ref(false),
	catalogError = ref<string | null>(null);
const candidates = computed(() =>
	isTransform
		? measurementCandidates(props.mode, devices.findAll(), channels.findAll(), properties.findAll()).filter(
				(candidate) =>
					model.operator !== 'extension' ||
					!selectedOperator.value ||
					(candidate.quantity === selectedOperator.value.input.quantity && candidate.unit === selectedOperator.value.input.unit)
			)
		: selectedProfile.value
			? aggregateCandidates(sources.value, devices.findAll(), channels.findAll(), properties.findAll(), selectedProfile.value)
			: []
);
const aggregatePreview = computed(() => (preview.value && 'inputs' in preview.value ? preview.value.preview_result : null));
const previewValue = (value: number | boolean | null | undefined, step?: number | null): string => {
	if (value == null) return '—';
	if (typeof value === 'boolean') return t(`devicesVirtualPlugin.measurement.${value ? 'detected' : 'notDetected'}`);
	// Presentation precision only: the backend has already evaluated and rounded this value.
	if (!(step && step > 0)) return String(value);
	const [coefficient, exponent] = String(step).split('e');
	const digits = Math.max(0, (coefficient.split('.')[1] ?? '').length - Number(exponent ?? 0));
	if (digits > 20) return String(value);
	return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
};
// Any source evidence or metadata update revokes both visible and in-flight previews.
watch(
	() =>
		model.inputs.map((input) => {
			const property = properties.findAll().find((entry) => entry.id === input.source_property);
			const channel = channels.findAll().find((entry) => entry.id === property?.channel);
			const device = devices.findAll().find((entry) => entry.id === channel?.device);
			return { property, channel, device };
		}),
	invalidatePreview,
	{ deep: true, flush: 'sync' }
);
watch(() => properties.findAll().find((entry) => entry.id === props.outputId)?.value?.producer?.revision, invalidatePreview, { flush: 'sync' });
const effectiveStep = computed(() =>
	current.value && 'output_step' in current.value ? current.value.output_step : (selectedProfile.value?.output_step ?? null)
);
const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
onUnmounted(() => clearInterval(clock));
const liveProducer = computed(() => properties.findAll().find((entry) => entry.id === props.outputId)?.value?.producer);
const liveReasons = computed(() => [
	...(liveProducer.value?.reasons ?? []),
	...(liveProducer.value?.expiresAt && Date.parse(liveProducer.value.expiresAt) <= now.value ? ['stale'] : []),
]);
const liveQuality = computed(() => {
	const producer = liveProducer.value;
	return producer &&
		producer.quality !== 'unavailable' &&
		producer.sampledAt &&
		producer.expiresAt &&
		Date.parse(producer.sampledAt) <= now.value &&
		Date.parse(producer.evaluatedAt) >= Date.parse(producer.sampledAt) &&
		Date.parse(producer.evaluatedAt) <= now.value &&
		Date.parse(producer.expiresAt) > now.value
		? producer.quality
		: 'unavailable';
});
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
	aggregateOperators = computed(() => selectedProfile.value?.operators ?? []);
const message = (key: string | null) => (key?.startsWith('measurement') ? t(`devicesVirtualPlugin.measurement.${key}`) : (key ?? ''));
const diagnosticLabel = (value: string | null | undefined): string => {
	if (!value) return '—';
	const [code, identity] = value.split(':', 2);
	const key = `devicesVirtualPlugin.measurement.states.${code}`;
	return te(key) ? `${t(key)}${identity ? ` · ${identity}` : ''}` : `${t('devicesVirtualPlugin.measurement.states.unknown')} (${value})`;
};
const reload = async () => {
	loading.value = true;
	catalogError.value = null;
	try {
		await devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
		await channels.fetch({});
		await Promise.all([...new Set(channels.findAll().map((channel) => channel.id))].map((channelId) => properties.fetch({ channelId })));
		await load();
		await loadCapabilities();
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
onMounted(() => {
	void reload();
	clock = setInterval(() => {
		now.value = Date.now();
	}, 1000);
});
</script>
