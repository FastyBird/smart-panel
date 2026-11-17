<template>
	<device-wizard-steps
		v-model="step"
		:steps="stepLabels"
		:can-advance="!busy"
		:before-next="validation.validate"
		:final-actions="wizardFinalActions"
		:dirty="step > 0 || !!source || !!name.trim()"
		:disabled="busy"
		enabled
	>
		<virtual-wizard-layout
			:compact="step < 2"
			enabled
			:review="step === 2"
			:title="step === 2 ? t('devicesVirtualPlugin.wizard.layout.reviewTitle') : stepLabels[step]"
			:description="
				t(`devicesVirtualPlugin.wizard.layout.${step === 2 ? 'reviewDescription' : step === 0 ? 'sourcesDescription' : 'outputDescription'}`)
			"
		>
			<el-button
				v-if="error"
				:disabled="busy"
				class="mb-3"
				data-test-id="native-wizard-refresh"
				@click="load"
			>
				{{ label('refresh') }}
			</el-button>

			<div v-show="step === 0">
				<el-alert
					:title="tt('intro')"
					:description="tt('supported')"
					type="info"
					:closable="false"
					show-icon
					class="mb-3"
				/>
				<el-form
					label-position="top"
					status-icon
				>
					<el-form-item
						:error="validation.error('source')"
						:label="label('unit')"
						required
					>
						<el-select
							v-model="source"
							:disabled="busy"
							:loading="loading"
							:placeholder="tt('unitPlaceholder')"
							filterable
							class="w-full"
							data-test-id="native-wizard-unit"
							@change="onSource"
						>
							<el-option-group
								v-for="group in groups"
								:key="group.provider"
								:label="providerLabel(group.provider)"
							>
								<el-option
									v-for="candidate in group.candidates"
									:key="candidate.device"
									:value="candidate.device"
									:disabled="candidate.reasons.length > 0"
									:label="candidate.reasons.length ? `${candidate.name} — ${reasonLabel(candidate.reasons[0]!)}` : candidate.name"
								/>
							</el-option-group>
						</el-select>
					</el-form-item>
				</el-form>
				<empty-state
					v-if="!loading && !error && !candidates.length"
					icon="mdi:thermostat"
					:description="tt('noCandidates')"
					data-test-id="native-wizard-empty"
				/>
			</div>

			<div v-show="step === 1">
				<el-form
					label-position="top"
					status-icon
				>
					<el-form-item
						:error="validation.error('name')"
						:label="t('devicesModule.fields.devices.name.title')"
						required
					>
						<el-input
							v-model="name"
							:disabled="busy"
							:placeholder="t('devicesModule.fields.devices.name.placeholder')"
							data-test-id="native-wizard-name"
						/>
					</el-form-item>
				</el-form>
				<el-alert
					:title="label('delegation')"
					type="info"
					:closable="false"
				/>
			</div>

			<div v-show="step === 2">
				<virtual-wizard-review-section
					:title="t('devicesVirtualPlugin.wizard.steps.details')"
					:disabled="busy"
					@edit="step = 1"
				>
					<virtual-wizard-descriptions :column="1">
						<el-descriptions-item :label="t('devicesModule.fields.devices.name.title')">{{ name }}</el-descriptions-item>
					</virtual-wizard-descriptions>
					<el-alert
						:title="label('acceptance')"
						class="m-4"
						type="info"
						:closable="false"
					/>
				</virtual-wizard-review-section>
			</div>
			<template #aside>
				<div
					class="flex flex-col gap-4"
					data-test-id="native-wizard-summary"
				>
					<virtual-wizard-summary
						:title="name"
						:subtitle="t('devicesVirtualPlugin.wizard.kinds.nativeThermostat.title')"
						:items="sidebarItems"
					/>
					<virtual-wizard-review-section
						v-if="step === 2"
						:title="stepLabels[0]"
						:disabled="busy"
						@edit="step = 0"
					>
						<virtual-wizard-descriptions :column="1">
							<el-descriptions-item :label="label('unit')">{{ selected?.name ?? '—' }}</el-descriptions-item>
						</virtual-wizard-descriptions>
					</virtual-wizard-review-section>
				</div>
			</template>
		</virtual-wizard-layout>
	</device-wizard-steps>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElDescriptionsItem, ElForm, ElFormItem, ElInput, ElOption, ElOptionGroup, ElSelect } from 'element-plus';

import { useBackend } from '../../../common';
import EmptyState from '../../../common/components/empty-state.vue';
import DeviceWizardSteps from '../../../modules/devices/components/wizard/device-wizard-steps.vue';
import type { IWizardAction } from '../../../modules/devices/components/wizard/device-wizard.types';
import { useWizardValidation } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import { type NativeCandidate, type NativeRange, nativeThermostatTransport } from '../services/native-thermostat';

import VirtualWizardDescriptions from './virtual-wizard-descriptions.vue';
import VirtualWizardLayout from './virtual-wizard-layout.vue';
import VirtualWizardReviewSection from './virtual-wizard-review-section.vue';
import VirtualWizardSummary from './virtual-wizard-summary.vue';

defineOptions({
	name: 'NativeThermostatWizard',
});

// Puts a Smart Panel controller on top of a thermostat that already exists as a device. The backend
// decides which devices qualify — today the Home Assistant and Zigbee2MQTT climate adapters — so the
// list is whatever it returns, grouped by the integration that owns the device; a unit another
// controller already holds stays visible but cannot be chosen.
const emit = defineEmits<{ created: [id: string]; busy: [value: boolean] }>();
const { t, te } = useI18n();
const label = (key: string): string => t(`devicesVirtualPlugin.nativeThermostat.${key}`);
const tt = (key: string, params: Record<string, unknown> = {}): string => t(`devicesVirtualPlugin.nativeThermostat.wizard.${key}`, params);
const known = (prefix: string, value: string): string => {
	const key = `devicesVirtualPlugin.nativeThermostat.wizard.${prefix}.${value}`;
	return te(key) ? t(key) : value;
};
const providerLabel = (provider: string): string => known('providers', provider);
const reasonLabel = (reason: string): string => known('reasons', reason);
const rangeLabel = (range: NativeRange | null | undefined): string =>
	range ? tt('summary.range', { minimum: range.minimum, maximum: range.maximum, step: range.step }) : tt('summary.unsupported');

const transport = nativeThermostatTransport(useBackend());
const candidates = ref<NativeCandidate[]>([]);
const source = ref('');
const name = ref('');
const step = ref(0);
const loading = ref(false);
const creating = ref(false);
const error = ref<string | null>(null);
const busy = computed<boolean>(() => loading.value || creating.value);
const selected = computed(() => candidates.value.find((candidate) => candidate.device === source.value));
const groups = computed(() => {
	const byProvider = new Map<string, NativeCandidate[]>();
	for (const candidate of candidates.value) byProvider.set(candidate.provider, [...(byProvider.get(candidate.provider) ?? []), candidate]);
	return [...byProvider].map(([provider, list]) => ({ provider, candidates: list })).sort((a, b) => a.provider.localeCompare(b.provider));
});
const stepLabels = computed<string[]>(() => ['device', 'details', 'review'].map((key) => t(`devicesVirtualPlugin.wizard.steps.${key}`)));
const needsRefresh = ref(false);
const validation = useWizardValidation(step, () =>
	step.value === 0
		? {
				source:
					selected.value && !selected.value.reasons.length && !needsRefresh.value ? undefined : t('devicesModule.wizard.validation.invalidValue'),
			}
		: { name: name.value.trim() ? undefined : t('devicesModule.fields.devices.name.validation.required') }
);

// The name starts as the device's own, and follows the selection until the user types one.
let suggested = '';
const onSource = (): void => {
	if (name.value.trim() && name.value !== suggested) return;
	suggested = selected.value?.name ?? '';
	name.value = suggested;
};

let alive = true;
const requests = new Set<AbortController>();
const REQUEST_DEADLINE_MS = 10_000;
/**
 * The shared client has no deadline of its own, and while a create is pending the shell refuses to
 * leave the page — so a stalled response would trap the user here. Every request is bounded; one
 * that runs out is aborted and handled like any other failure.
 */
const bounded = async <T,>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
	const request = new AbortController();
	requests.add(request);
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			operation(request.signal),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					request.abort();
					reject(new Error('deadline'));
				}, REQUEST_DEADLINE_MS);
			}),
		]);
	} finally {
		clearTimeout(timer);
		requests.delete(request);
	}
};
const load = async (): Promise<boolean> => {
	loading.value = true;
	error.value = null;
	try {
		const result = await bounded((signal) => transport.candidates(signal));
		if (alive) {
			candidates.value = result;
			needsRefresh.value = false;
			if (step.value === 2) step.value = 0;
		}
		return true;
	} catch {
		if (alive) {
			// A list that could not be read says nothing about what is eligible now.
			candidates.value = [];
			error.value = label('readFailed');
		}
		return false;
	} finally {
		if (alive) loading.value = false;
	}
};
const create = async (): Promise<void> => {
	const unit = selected.value;
	if (busy.value || needsRefresh.value || !unit || unit.reasons.length || !name.value.trim()) return;
	creating.value = true;
	error.value = null;
	try {
		const result = await bounded((signal) => transport.create(name.value.trim(), unit.device, signal));
		if (!alive) return;
		creating.value = false;
		// Let the shell see the request has ended before it is asked to navigate away.
		await nextTick();
		emit('created', result.controller);
	} catch {
		if (!alive) return;
		creating.value = false;
		// The request may have been applied. Keep the reviewed selection stable; only an explicit
		// refresh may replace it and determine whether another attempt is safe.
		needsRefresh.value = true;
		error.value = label('uncertain');
	}
};
watch(creating, (value) => emit('busy', value));
onMounted(load);
onBeforeUnmount(() => {
	alive = false;
	for (const request of requests) request.abort();
});
const wizardFinalActions = computed<IWizardAction[]>(() => [
	{
		id: 'create',
		label: label('create'),
		variant: 'primary',
		disabled: busy.value || needsRefresh.value || !name.value.trim() || !selected.value || selected.value.reasons.length > 0,
		handler: create,
	},
]);

const sidebarItems = computed(() => [
	{ label: label('unit'), value: selected.value?.name },
	{ label: tt('summary.provider'), value: selected.value ? providerLabel(selected.value.provider) : '—' },
	{ label: label('heating'), value: rangeLabel(selected.value?.capabilities.heating) },
	{ label: label('cooling'), value: rangeLabel(selected.value?.capabilities.cooling) },
	{
		label: tt('summary.modes'),
		value: selected.value?.capabilities.modes.map((mode) => t(`devicesVirtualPlugin.thermostat.modes.${mode}`)).join(', '),
	},
]);
useVirtualWizardError(error);
</script>
