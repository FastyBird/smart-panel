<template>
	<el-card
		header-class="px-3! py-3! font-bold"
		:class="stepped ? 'border-0! shadow-none! bg-transparent!' : ''"
		:body-class="stepped ? 'p-0!' : undefined"
		shadow="never"
		data-test-id="dew-point-editor"
	>
		<template
			v-if="!stepped"
			#header
		>
			{{ t('devicesVirtualPlugin.dewPoint.title') }}
		</template>
		<el-alert
			v-if="!stepped"
			:title="t('devicesVirtualPlugin.dewPoint.boundary')"
			type="info"
			:closable="false"
		/>

		<el-button
			v-if="catalogError"
			:loading="loadingCatalog"
			class="mb-3"
			@click="loadCatalog"
		>
			{{ t('devicesVirtualPlugin.measurement.reload') }}
		</el-button>
		<device-wizard-steps
			v-model="step"
			:enabled="stepped"
			:steps="stepLabels"
			:before-next="beforeNext"
			:can-advance="canAdvance"
			:final-actions="wizardFinalActions"
			:dirty="step > 0 || !!model.name.trim()"
			:disabled="busy"
		>
			<virtual-wizard-layout
				:compact="step === 0"
				:loading="loadingCatalog"
				:loading-text="t('devicesVirtualPlugin.measurement.loadingCatalog')"
				:enabled="stepped"
				:review="step === 3"
				:title="stepped ? (step === 3 ? t('devicesVirtualPlugin.wizard.layout.reviewTitle') : stepLabels[step]) : undefined"
				:description="
					stepped
						? t(
								step < 2
									? `devicesVirtualPlugin.dewPoint.${step === 0 ? 'description' : 'sourcesDescription'}`
									: `devicesVirtualPlugin.wizard.layout.${step === 2 ? 'processingDescription' : 'reviewDescription'}`
							)
						: undefined
				"
			>
				<el-form
					v-if="!stepped || !at(3)"
					v-loading="!stepped && loadingCatalog"
					label-position="top"
					:disabled="busy || loadingCatalog"
					status-icon
				>
					<el-form-item
						v-if="!outputId"
						v-show="at(0)"
						:error="validation.error('name')"
						:label="t('devicesModule.fields.devices.name.title')"
						required
					>
						<el-input
							v-model="model.name"
							:placeholder="t('devicesModule.fields.devices.name.placeholder')"
							name="name"
						/>
					</el-form-item>
					<div
						v-if="!outputId"
						v-show="at(0)"
					>
						<virtual-placement-fields
							v-model:room-id="model.roomId"
							v-model:zone-ids="model.zoneIds"
							:suggest-sources="stepped"
							:disabled="busy"
						/>
					</div>
					<el-form-item
						v-if="stepped && at(1)"
						:error="validation.error('dry_bulb') || validation.error('relative_humidity')"
					>
						<virtual-wizard-source-picker
							:sources="availablePickerSources"
							:selected="selectedSources"
							:room-id="model.roomId"
							:zone-ids="model.zoneIds"
							:disabled="busy || loadingCatalog"
							@add="addSource"
							@remove="removeSource"
						/>
					</el-form-item>
					<el-form-item
						v-for="role in inlineRoles"
						v-show="at(1)"
						:key="role.key"
						:error="validation.error(role.key)"
						:label="t(`devicesVirtualPlugin.dewPoint.${role.key}`)"
						required
					>
						<el-select
							v-model="model[role.field]"
							filterable
						>
							<el-option-group
								v-for="group in sourceGroups(role.key)"
								:key="group.id"
								:label="group.label"
							>
								<el-option
									v-for="candidate in group.items"
									:key="candidate.id"
									:value="candidate.id"
									:label="candidate.label"
								/>
							</el-option-group>
						</el-select>
						<p v-if="current?.sources.find((s) => s.role === role.key)?.source_property === null">
							{{ t('devicesVirtualPlugin.dewPoint.retained') }}: {{ current?.sources.find((s) => s.role === role.key)?.source_identity }}
						</p>
					</el-form-item>
					<div
						v-show="at(2)"
						class="grid grid-cols-1 md:grid-cols-2 gap-x-4"
					>
						<el-form-item
							v-show="at(2)"
							:error="validation.error('age')"
							:label="t('devicesVirtualPlugin.measurement.maximumAge')"
							required
						>
							<el-input-number
								v-model="model.maximumAgeSeconds"
								:min="1"
								:max="86400"
							/>
						</el-form-item>
						<el-form-item
							v-show="at(2)"
							:error="validation.error('skew')"
							:label="t('devicesVirtualPlugin.dewPoint.skew')"
							required
						>
							<el-input-number
								v-model="model.maximumSkewSeconds"
								:min="0"
								:max="3600"
							/>
						</el-form-item>
					</div>
					<el-alert
						v-show="at(2)"
						:title="t('devicesVirtualPlugin.measurement.help.processingTitle')"
						:description="t('devicesVirtualPlugin.dewPoint.processingHelp')"
						type="info"
						:closable="false"
						show-icon
					/>
					<device-wizard-review-checks
						v-if="stepped && at(2) && validationAttempted && processingErrors.length"
						:checks="processingErrors"
					/>
				</el-form>
				<template v-if="stepped && at(3)">
					<virtual-wizard-review-section
						:title="t('devicesVirtualPlugin.wizard.steps.details')"
						:disabled="busy"
						@edit="step = 0"
					>
						<virtual-wizard-descriptions
							:column="2"
							data-test-id="dew-point-summary"
						>
							<el-descriptions-item :label="t('devicesModule.fields.devices.name.title')">{{ model.name }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.room.title')">{{ roomName(model.roomId) }}</el-descriptions-item>
							<el-descriptions-item :label="t('devicesModule.fields.devices.zones.title')">{{ zoneNames(model.zoneIds) }}</el-descriptions-item>
						</virtual-wizard-descriptions>
					</virtual-wizard-review-section>
					<virtual-wizard-review-section
						:title="stepLabels[1]"
						:disabled="busy"
						@edit="step = 1"
					>
						<virtual-wizard-source-picker
							:sources="[]"
							:selected="reviewSources"
							read-only
							data-test-id="dew-point-review-sources"
						/>
					</virtual-wizard-review-section>
					<virtual-wizard-review-section
						:title="stepLabels[2]"
						:disabled="busy"
						@edit="step = 2"
					>
						<virtual-wizard-descriptions :column="2">
							<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.maximumAge')">{{ model.maximumAgeSeconds }} s</el-descriptions-item>
							<el-descriptions-item :label="t('devicesVirtualPlugin.dewPoint.skew')">{{ model.maximumSkewSeconds }} s</el-descriptions-item>
						</virtual-wizard-descriptions>
					</virtual-wizard-review-section>
				</template>
				<template #aside>
					<virtual-wizard-summary
						v-if="stepped && step !== 3"
						:title="model.name"
						:subtitle="t('devicesVirtualPlugin.dewPoint.title')"
						:items="sidebarItems"
					/>

					<div v-show="!stepped || step > 0">
						<virtual-wizard-card
							v-if="stepped || preview || current"
							icon="mdi:calculator"
							body-class="flex flex-col gap-3"
						>
							<template #header>
								<div class="flex items-center justify-between gap-2">
									<strong>
										{{
											t(
												stepped && step !== 3
													? 'devicesVirtualPlugin.wizard.layout.livePreview'
													: 'devicesVirtualPlugin.measurement.help.previewTitle'
											)
										}}
									</strong>
									<el-button
										v-if="stepped"
										size="small"
										:loading="previewPending || (busy && !submitting)"
										:disabled="busy || !draftValid || loadingCatalog"
										@click="recalculate(true)"
									>
										{{ t('devicesVirtualPlugin.wizard.layout.recalculate') }}
									</el-button>
								</div>
							</template>
							<device-wizard-review-checks
								v-if="!stepped"
								:checks="reviewChecks"
							/>

							<el-text v-if="stepped && !displayPreview">
								{{ t('devicesVirtualPlugin.wizard.layout.previewHint') }}
							</el-text>

							<p
								v-if="current"
								data-test-id="dew-point-diagnostics"
							>
								{{ current.quantity }} · {{ currentFresh ? current.current_value : '—' }} {{ current.unit }} ·
								{{ currentFresh ? current.quality : 'unavailable' }} · {{ current.errors.join(', ') }}
							</p>
							<div
								v-for="source in current?.sources ?? []"
								:key="source.role"
							>
								{{ t(`devicesVirtualPlugin.dewPoint.${source.role}`) }} · {{ source.source_identity }} · {{ source.age_seconds ?? '—' }} s ·
								{{ source.errors.join(', ') }}
							</div>
							<virtual-wizard-descriptions
								v-if="displayPreview"
								card-inset
								:column="1"
								data-test-id="dew-point-preview"
							>
								<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.result')">
									<el-text
										size="large"
										class="text-3xl! font-semibold"
									>
										{{ displayPreview.current_value ?? '—' }} {{ displayPreview.unit }}
									</el-text>
								</el-descriptions-item>
								<el-descriptions-item :label="t('devicesVirtualPlugin.measurement.help.quality')">
									<el-tag :type="displayPreview.quality === 'good' ? 'success' : 'warning'">
										{{ t(`devicesVirtualPlugin.measurement.states.${displayPreview.quality}`) }}
									</el-tag>
								</el-descriptions-item>
								<el-descriptions-item
									v-if="stepped ? previewReasons.length : displayPreview.errors.length"
									:label="t('devicesVirtualPlugin.measurement.help.diagnostics')"
								>
									{{ stepped ? previewReasons.join(', ') : displayPreview.errors.join(', ') }}
								</el-descriptions-item>
								<el-descriptions-item
									v-if="!stepped"
									:label="t('devicesVirtualPlugin.measurement.inputs')"
								>
									<div
										v-for="source in displayPreview.sources"
										:key="source.role"
									>
										{{ t(`devicesVirtualPlugin.dewPoint.${source.role}`) }} · {{ source.source_identity }} · {{ source.current_value ?? '—' }}
										{{ source.unit }} · {{ source.age_seconds ?? '—' }} s · {{ source.errors.join(', ') }}
									</div>
								</el-descriptions-item>
							</virtual-wizard-descriptions>
						</virtual-wizard-card>
					</div>
				</template>
			</virtual-wizard-layout>
			<template #final>
				<el-button
					v-if="!stepped"
					:disabled="busy"
					@click="reload"
				>
					{{ t('devicesVirtualPlugin.measurement.reload') }}
				</el-button>
				<el-button
					v-if="!stepped || !preview"
					:disabled="busy"
					@click="check"
				>
					{{ t('devicesVirtualPlugin.measurement.preview') }}
				</el-button>
				<el-button
					type="primary"
					:disabled="!canSave"
					@click="submit"
				>
					{{ t(`devicesVirtualPlugin.measurement.${outputId ? 'save' : 'create'}`) }}
				</el-button>
			</template>
		</device-wizard-steps>
	</el-card>
</template>
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElDescriptionsItem,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElOptionGroup,
	ElSelect,
	ElTag,
	ElText,
	vLoading,
} from 'element-plus';

import { injectStoresManager } from '../../../common';
import type { IWizardReviewCheck } from '../../../modules/devices/components/wizard/device-wizard-review-checks.types';
import DeviceWizardReviewChecks from '../../../modules/devices/components/wizard/device-wizard-review-checks.vue';
import DeviceWizardSteps from '../../../modules/devices/components/wizard/device-wizard-steps.vue';
import type { IWizardAction } from '../../../modules/devices/components/wizard/device-wizard.types';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { channelsPropertiesStoreKey, channelsStoreKey, devicesStoreKey } from '../../../modules/devices/store/keys';
import { DevicesModuleDevicesHiddenFilter } from '../../../openapi.constants';
import { useDewPointAuthoring } from '../composables/use-dew-point-authoring';
import { usePlacementNames } from '../composables/use-placement-names';
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import { provideVirtualWizardPlacement, useVirtualWizardSourceGroups } from '../composables/use-virtual-wizard-placement';
import { preferCanonicalMeasurementSources } from '../utils/measurement-authoring.utils';
import { formatSourceSampleAge, sourceSampleAge } from '../utils/source-sample-age';

import VirtualPlacementFields from './virtual-placement-fields.vue';
import VirtualWizardCard from './virtual-wizard-card.vue';
import VirtualWizardDescriptions from './virtual-wizard-descriptions.vue';
import VirtualWizardLayout from './virtual-wizard-layout.vue';
import VirtualWizardReviewSection from './virtual-wizard-review-section.vue';
import type { VirtualWizardSource } from './virtual-wizard-source-picker.types';
import VirtualWizardSourcePicker from './virtual-wizard-source-picker.vue';
import VirtualWizardSummary from './virtual-wizard-summary.vue';

const props = withDefaults(defineProps<{ outputId?: string; wizard?: boolean }>(), { outputId: undefined });
const emit = defineEmits<{ created: [id: string]; busy: [value: boolean] }>();
const { t, te, locale } = useI18n();
const { roomName, zoneNames } = usePlacementNames();
const { model, current, preview, busy, error, reason, canSave, reload, check, evaluateDraft, save } = useDewPointAuthoring(props.outputId);
// Captured response expiry is never renewed by rendering or a wall-clock rollback.
const diagnosticNow = ref(Date.now()),
	diagnosticMonotonic = ref(performance.now());
let monotonicExpiry = 0;
let lastExpiry: number | null = null;
let lastSourceContract: string | null = null;
let clock: ReturnType<typeof setInterval> | undefined;
watch(
	current,
	(state) => {
		const expiry = Date.parse(state?.expires_at ?? '');
		const contract = JSON.stringify([state?.revision, state?.sources.map((source) => [source.source_identity, source.contract_fingerprint])]);
		if (state?.quality !== 'good' || !Number.isFinite(expiry)) monotonicExpiry = 0;
		else if (lastExpiry === null || expiry > lastExpiry) {
			lastExpiry = expiry;
			lastSourceContract = contract;
			monotonicExpiry = performance.now() + Math.max(0, expiry - Date.now());
		} else if (expiry < lastExpiry || contract !== lastSourceContract) monotonicExpiry = 0;
		// An identical cached response retains the first monotonic budget, including after rollback or a source gap.
	},
	{ flush: 'sync' }
);
const currentFresh = computed(
	() =>
		current.value?.quality === 'good' &&
		diagnosticNow.value < Date.parse(current.value.expires_at ?? '') &&
		diagnosticMonotonic.value < monotonicExpiry
);
onMounted(() => {
	clock = setInterval(() => {
		diagnosticNow.value = Date.now();
		diagnosticMonotonic.value = performance.now();
	}, 1000);
});
onUnmounted(() => {
	if (clock) clearInterval(clock);
});
const stores = injectStoresManager(),
	devices = stores.getStore(devicesStoreKey),
	channels = stores.getStore(channelsStoreKey),
	properties = stores.getStore(channelsPropertiesStoreKey);
const roles = [
	{ key: 'dry_bulb', field: 'dryBulb' },
	{ key: 'relative_humidity', field: 'humidity' },
] as const;
function candidates(role: string) {
	const quantity = role === 'dry_bulb' ? 'temperature' : 'humidity',
		unit = role === 'dry_bulb' ? '°C' : '%';
	return properties.findAll().flatMap((p) => {
		const channel = channels.findById(p.channel),
			device = channel && devices.findById(channel.device);
		if (
			!device ||
			((p as { measurementQuantity?: string }).measurementQuantity != null &&
				(p as { measurementQuantity?: string }).measurementQuantity !== quantity) ||
			channel?.category !== quantity ||
			p.category !== quantity ||
			p.unit !== unit ||
			!p.permissions.some((permission) => ['ro', 'rw'].includes(permission))
		)
			return [];
		return [{ id: p.id, label: `${device.name} / ${channel.name} / ${p.name ?? quantity}` }];
	});
}
// Same four steps as the numeric editor; see there for why the form is shown a section at a time.
const stepped = computed<boolean>(() => props.wizard === true && !props.outputId);
const step = ref(0);
const validationAttempted = ref(false);
const at = (index: number): boolean => !stepped.value || step.value === index;
const stepLabels = computed<string[]>(() =>
	['output', 'sources', 'processing', 'review'].map((key) => t(`devicesVirtualPlugin.wizard.steps.${key}`))
);
const canAdvance = computed(() => !busy.value && !loadingCatalog.value && !catalogError.value);

const reviewChecks = computed<IWizardReviewCheck[]>(() => [
	...roles.map(
		(role): IWizardReviewCheck => ({
			id: role.key,
			label: t(`devicesVirtualPlugin.dewPoint.${role.key}`),
			value: candidates(role.key).find((candidate) => candidate.id === model[role.field])?.label ?? model[role.field] ?? '—',
			status: model[role.field] ? 'success' : 'error',
			detail: model[role.field]
				? undefined
				: t('devicesVirtualPlugin.dewPoint.requiredRole', { role: t(`devicesVirtualPlugin.dewPoint.${role.key}`) }),
		})
	),
	{
		id: 'age',
		label: t('devicesVirtualPlugin.measurement.maximumAge'),
		value: String(model.maximumAgeSeconds),
		status: Number.isInteger(model.maximumAgeSeconds) && model.maximumAgeSeconds >= 1 && model.maximumAgeSeconds <= 86400 ? 'success' : 'error',
	},
	{
		id: 'skew',
		label: t('devicesVirtualPlugin.dewPoint.skew'),
		value: String(model.maximumSkewSeconds),
		status: Number.isInteger(model.maximumSkewSeconds) && model.maximumSkewSeconds >= 0 && model.maximumSkewSeconds <= 3600 ? 'success' : 'error',
	},
	{
		id: 'backend',
		label: t('devicesVirtualPlugin.conversion.backendCheck'),
		status: error.value ? 'error' : preview.value ? 'success' : 'info',
		detail: error.value
			? `${t(`devicesVirtualPlugin.dewPoint.errors.${error.value}`)}${reason.value ? ` · ${reason.value}` : ''}`
			: preview.value
				? undefined
				: t(`devicesVirtualPlugin.conversion.validation.${busy.value ? 'checking' : 'notChecked'}`),
	},
]);
const processingErrors = computed(() => reviewChecks.value.filter((check) => check.status === 'error'));
const validation = useWizardValidation(step, () => {
	if (step.value === 0) return { name: model.name.trim() ? undefined : t('devicesModule.fields.devices.name.validation.required') };
	return Object.fromEntries(
		reviewChecks.value
			.filter(
				(check) => check.id !== 'backend' && (step.value === 1 ? roles.some((role) => role.key === check.id) : ['age', 'skew'].includes(check.id))
			)
			.map((check) => [check.id, check.status === 'error' ? (check.detail ?? t('devicesModule.wizard.validation.invalidValue')) : undefined])
	);
});
const beforeNext = async (): Promise<boolean> => {
	validationAttempted.value = true;
	if (!validation.validate()) return false;
	if (step.value !== 2) return true;
	await check();
	return canSave.value;
};
async function submit() {
	submitting.value = true;
	try {
		const id = await save();
		if (id) emit('created', id);
	} finally {
		submitting.value = false;
	}
}
watch(busy, (value) => emit('busy', value), { immediate: true });
onMounted(() => void loadCatalog());
const wizardFinalActions = computed<IWizardAction[]>(() => [
	{
		id: 'create',
		label: t('devicesVirtualPlugin.measurement.create'),
		variant: 'primary',
		disabled: !canSave.value || loadingCatalog.value || catalogError.value,
		handler: submit,
	},
]);

const sidebarItems = computed(() => [
	{ label: t('devicesModule.fields.devices.room.title'), value: roomName(model.roomId) },
	...roles.map((role) => ({
		label: t(`devicesVirtualPlugin.dewPoint.${role.key}`),
		value: selectedSources.value.find((source) => source.id === model[role.field])?.name ?? '—',
	})),
	{ label: t('devicesVirtualPlugin.measurement.maximumAge'), value: `${model.maximumAgeSeconds} s` },
	{ label: t('devicesVirtualPlugin.dewPoint.skew'), value: `${model.maximumSkewSeconds} s` },
]);

provideVirtualWizardPlacement(computed(() => (stepped.value ? { roomId: model.roomId, zoneIds: model.zoneIds } : {})));

const groupSources = useVirtualWizardSourceGroups();
const sourceGroups = (role: string) =>
	groupSources(
		candidates(role),
		(candidate) => {
			const property = properties.findById(candidate.id);
			const channel = channels.findById(property?.channel ?? '');
			return devices.findAll().find((device) => device.id === channel?.device);
		},
		stepped.value ? { roomId: model.roomId, zoneIds: model.zoneIds } : {}
	);

const inlineRoles = computed(() => (stepped.value ? [] : roles));
const loadingCatalog = ref(true),
	catalogError = ref(false),
	submitting = ref(false);
const loadCatalog = async () => {
	loadingCatalog.value = true;
	catalogError.value = false;
	try {
		await devices.fetch({ hidden: DevicesModuleDevicesHiddenFilter.all });
	} catch {
		catalogError.value = true;
	} finally {
		loadingCatalog.value = false;
	}
};
const diagnosticLabel = (code: string) => {
	const key = `devicesVirtualPlugin.measurement.states.${code}`;
	if (te?.(key)) return t(key);
	const specificKey = `devicesVirtualPlugin.dewPoint.diagnostics.${code}`;
	return te?.(specificKey) ? t(specificKey) : `${t('devicesVirtualPlugin.measurement.states.unknown')} (${code})`;
};
const pickerSources = computed<VirtualWizardSource[]>(() =>
	roles.flatMap((role) =>
		candidates(role.key).map((candidate) => {
			const property = properties.findById(candidate.id)!;
			const channel = channels.findById(property.channel);
			const device = channel && devices.findById(channel.device);
			const age = sourceSampleAge(property.value?.lastUpdated, Date.now());
			const value = property.value?.value;
			const hasReading = device?.status?.online !== false && typeof value === 'number' && Number.isFinite(value);
			return {
				id: candidate.id,
				name: device?.name ?? candidate.label,
				detail: `${t(`devicesVirtualPlugin.dewPoint.${role.key}`)} · ${channel?.name ?? ''}`,
				roomId: device?.roomId ?? null,
				zoneIds: device?.zoneIds ?? [],
				room: roomName(device?.roomId ?? null),
				online: device?.status?.online ?? null,
				reading: hasReading ? `${value} ${property.unit ?? ''}`.trim() : '—',
				readingHint: hasReading && age === null ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTimeHint') : undefined,
				age: hasReading && age === null ? t('devicesVirtualPlugin.wizard.layout.unknownSampleTime') : formatSourceSampleAge(age, locale?.value),
			};
		})
	)
);
// Keep all metadata for saved bindings; collapse duplicate physical readings only in the add list.
const availablePickerSources = computed(() =>
	preferCanonicalMeasurementSources(pickerSources.value, devices.findAll(), channels.findAll(), properties.findAll())
);
const selectedSources = computed(() =>
	roles.flatMap((role) => {
		const id = model[role.field];
		if (!id) return [];
		const source = pickerSources.value.find((source) => source.id === id);
		const age = sourceSampleAge(properties.findById(id)?.value?.lastUpdated, diagnosticNow.value);
		return [
			source
				? {
						...source,
						age:
							source.reading !== '—' && age === null
								? t('devicesVirtualPlugin.wizard.layout.unknownSampleTime')
								: formatSourceSampleAge(age, locale?.value),
					}
				: {
						id,
						name: t('devicesVirtualPlugin.measurement.missing', { id }),
						detail: t(`devicesVirtualPlugin.dewPoint.${role.key}`),
						roomId: null,
						room: '—',
						online: null,
						reading: '—',
						age: '—',
					},
		];
	})
);

const addSource = (id: string) => {
	if (busy.value || loadingCatalog.value) return;
	const role = roles.find((role) => candidates(role.key).some((candidate) => candidate.id === id));
	if (role) model[role.field] = id;
};
const removeSource = (id: string) => {
	if (busy.value) return;
	for (const role of roles) if (model[role.field] === id) model[role.field] = null;
};
const reviewSources = ref<VirtualWizardSource[]>([]);
watch(
	preview,
	(snapshot) => {
		if (!snapshot || !stepped.value) {
			reviewSources.value = [];
			return;
		}
		reviewSources.value = roles.map((role) => {
			const source = snapshot.sources.find((source) => source.role === role.key);
			const metadata = selectedSources.value.find((row) => row.id === model[role.field]);
			// The server's evaluated age stays authoritative when the browser clock differs.
			const sampledAt = source?.sampled_at;
			const unknownTime = sampledAt === null || (sampledAt !== undefined && (!Number.isFinite(Date.parse(sampledAt)) || Date.parse(sampledAt) <= 0));
			const age = unknownTime ? null : (source?.age_seconds ?? sourceSampleAge(sampledAt, Date.now()));
			const failure = source?.errors[0];
			return {
				id: source?.source_identity ?? model[role.field] ?? role.key,
				name: metadata?.name ?? '—',
				detail: metadata?.detail ?? t(`devicesVirtualPlugin.dewPoint.${role.key}`),
				roomId: metadata?.roomId ?? null,
				room: metadata?.room ?? '—',
				online: metadata?.online ?? null,
				reading: source?.current_value == null ? '—' : `${source.current_value} ${source.unit ?? ''}`.trim(),
				age: formatSourceSampleAge(age, locale?.value),
				state: {
					label: failure ? diagnosticLabel(failure) : t('devicesVirtualPlugin.measurement.help.included'),
					type: failure ? ('warning' as const) : ('success' as const),
				},
			};
		});
	},
	{ flush: 'sync' }
);
const draftValid = computed(
	() =>
		!!model.name.trim() &&
		!!model.dryBulb &&
		!!model.humidity &&
		Number.isInteger(model.maximumAgeSeconds) &&
		model.maximumAgeSeconds >= 1 &&
		model.maximumAgeSeconds <= 86400 &&
		Number.isInteger(model.maximumSkewSeconds) &&
		model.maximumSkewSeconds >= 0 &&
		model.maximumSkewSeconds <= 3600
);
const sidebarPreview = ref<Awaited<ReturnType<typeof evaluateDraft>> | null>(null),
	previewPending = ref(false);
const displayPreview = computed(() => (stepped.value ? (step.value === 3 ? preview.value : sidebarPreview.value) : preview.value));
const previewReasons = computed(() =>
	(displayPreview.value?.errors ?? []).filter((error) => !roles.some((role) => error.startsWith(`${role.key}:`))).map(diagnosticLabel)
);

let sidebarGeneration = 0,
	sidebarRequest: AbortController | undefined,
	sidebarTimer: ReturnType<typeof setTimeout> | undefined;
const stopSidebar = () => {
	sidebarGeneration++;
	clearTimeout(sidebarTimer);
	sidebarRequest?.abort();
	previewPending.value = false;
};
const recalculate = async (reportFailure = false) => {
	if (step.value === 3) {
		await check();
		return;
	}
	stopSidebar();
	if (!stepped.value || busy.value || loadingCatalog.value || !draftValid.value) return;
	const generation = sidebarGeneration,
		request = (sidebarRequest = new AbortController());
	const timeout = setTimeout(() => request.abort(), 10000);
	previewPending.value = true;

	try {
		const result = await evaluateDraft(request.signal);
		if (generation === sidebarGeneration) sidebarPreview.value = result;
	} catch {
		if (generation === sidebarGeneration && reportFailure) notifyError(t('devicesVirtualPlugin.wizard.layout.previewError'));
	} finally {
		clearTimeout(timeout);
		if (generation === sidebarGeneration) previewPending.value = false;
	}
};
watch(
	[
		() => JSON.stringify(model),
		step,
		busy,
		loadingCatalog,
		() =>
			JSON.stringify(
				roles.map((role) => {
					const property = model[role.field] ? properties.findById(model[role.field]!) : null;
					const channel = property && channels.findById(property.channel);
					return [property?.value, channel && devices.findById(channel.device)?.status];
				})
			),
	],
	() => {
		stopSidebar();

		if (!stepped.value || step.value === 0 || step.value === 3 || busy.value || loadingCatalog.value) return;
		if (draftValid.value) {
			previewPending.value = true;
			sidebarTimer = setTimeout(() => void recalculate(), 350);
		} else sidebarPreview.value = null;
	},
	{ flush: 'sync' }
);
onUnmounted(stopSidebar);
const notifyError = useVirtualWizardError(() =>
	error.value
		? `${t(`devicesVirtualPlugin.dewPoint.errors.${error.value}`)}${reason.value ? ` · ${reason.value}` : ''}`
		: catalogError.value
			? t('devicesVirtualPlugin.measurement.measurementCatalog')
			: null
);
</script>
