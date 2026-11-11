<template>
	<virtual-wizard-steps
		v-model="step"
		:steps="stepLabels"
		:can-advance="canAdvance"
		:disabled="busy"
		enabled
	>
		<el-alert
			v-if="error"
			:title="error"
			type="error"
			:closable="false"
			class="mb-3"
			data-test-id="native-wizard-error"
		/>
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
			<el-form label-position="top">
				<el-form-item :label="label('unit')">
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
			<el-empty
				v-if="!loading && !error && !candidates.length"
				:description="tt('noCandidates')"
				data-test-id="native-wizard-empty"
			/>
		</div>

		<div v-show="step === 1">
			<el-form label-position="top">
				<el-form-item :label="label('name')">
					<el-input
						v-model="name"
						:disabled="busy"
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
			<el-descriptions
				:column="1"
				border
				class="mb-3"
				data-test-id="native-wizard-summary"
			>
				<el-descriptions-item :label="label('name')">{{ name }}</el-descriptions-item>
				<el-descriptions-item :label="label('unit')">{{ selected?.name ?? '—' }}</el-descriptions-item>
				<el-descriptions-item :label="tt('summary.provider')">{{ selected ? providerLabel(selected.provider) : '—' }}</el-descriptions-item>
				<el-descriptions-item :label="tt('summary.modes')">
					{{ selected?.capabilities.modes.map((mode) => t(`devicesVirtualPlugin.thermostat.modes.${mode}`)).join(', ') || '—' }}
				</el-descriptions-item>
				<el-descriptions-item :label="label('heating')">{{ rangeLabel(selected?.capabilities.heating) }}</el-descriptions-item>
				<el-descriptions-item :label="label('cooling')">{{ rangeLabel(selected?.capabilities.cooling) }}</el-descriptions-item>
			</el-descriptions>
			<el-alert
				:title="label('acceptance')"
				type="info"
				:closable="false"
			/>
		</div>

		<template #final>
			<el-button
				type="primary"
				:loading="creating"
				:disabled="busy || !name.trim() || !selected || selected.reasons.length > 0"
				data-test-id="native-wizard-create"
				@click="create"
			>
				{{ label('create') }}
			</el-button>
		</template>
	</virtual-wizard-steps>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElDescriptions,
	ElDescriptionsItem,
	ElEmpty,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElOptionGroup,
	ElSelect,
} from 'element-plus';

import { useBackend } from '../../../common';
import { type NativeCandidate, type NativeRange, nativeThermostatTransport } from '../services/native-thermostat';

import VirtualWizardSteps from './wizard/virtual-wizard-steps.vue';

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
const canAdvance = computed<boolean>(() => {
	if (step.value === 0) return !!selected.value && !selected.value.reasons.length;
	return !!name.value.trim();
});

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
		if (alive) candidates.value = result;
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
	if (busy.value || !unit || unit.reasons.length || !name.value.trim()) return;
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
		// The request may have been applied. Only a fresh list can say whether the unit is now taken,
		// so another attempt waits for one: a failed refresh leaves nothing to choose from.
		await load();
		if (alive) error.value = label('uncertain');
	}
};
watch(creating, (value) => emit('busy', value));
onMounted(load);
onBeforeUnmount(() => {
	alive = false;
	for (const request of requests) request.abort();
});
</script>
