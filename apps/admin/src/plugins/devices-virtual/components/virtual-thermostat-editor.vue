<template>
	<el-card
		v-if="canAuthor"
		shadow="never"
		class="mt-2"
		data-test-id="virtual-thermostat-editor"
	>
		<template #header>
			<strong>{{ create ? 'Create virtual thermostat' : 'Thermostat configuration' }}</strong>
		</template>
		<el-alert
			type="info"
			:closable="false"
			title="Draft controller"
			description="Configuration and reservations persist, but heating and cooling remain unavailable until hardware qualification and runtime reconciliation."
		/>
		<el-alert
			v-if="loadError"
			type="error"
			:closable="false"
			:title="loadError"
			class="mt-2"
		/>
		<div
			v-if="loading"
			v-loading="true"
			class="h-20"
		/>
		<template v-else>
			<virtual-wizard-steps
				v-model="step"
				:enabled="create"
				:steps="stepLabels"
				:can-advance="canAdvance"
				:disabled="busy"
			>
				<div v-show="at(0)">
					<el-form-item
						v-if="create"
						label="Thermostat name"
						class="mt-3"
					>
						<el-input v-model="name" />
					</el-form-item>
					<div
						v-if="configuration"
						class="mt-3 space-y-2"
					>
						<p>
							Configuration revision {{ configuration.revision }} · graph revision {{ configuration.graph_revision }} · {{ configuration.readiness }}
						</p>
						<el-alert
							v-for="reason in configuration.reasons"
							:key="reason"
							type="warning"
							:closable="false"
							:title="reason"
						/>
						<el-alert
							v-for="claim in configuration.actuators"
							:key="claim.id"
							:type="claim.state === 'reserved' ? 'info' : 'warning'"
							:closable="false"
							:title="`${claim.role}: ${claim.state} · ${claim.physical_identity}`"
							:description="claim.reason ?? undefined"
						/>
						<el-alert
							v-for="source in configuration.sources.filter((entry) => !entry.source_property)"
							:key="source.id"
							type="warning"
							:closable="false"
							:title="`${source.role}: missing ${source.source_identity}`"
						/>
					</div>
					<el-divider content-position="left">Requested settings</el-divider>
					<el-form
						label-position="top"
						class="space-y-3"
					>
						<el-form-item label="Requested mode (intent, not reported activity)">
							<el-select
								v-model="draft.requested_mode"
								class="w-40"
							>
								<el-option
									v-for="mode in modeNames"
									:key="mode"
									:value="mode"
									:label="mode"
								/>
							</el-select>
						</el-form-item>
						<div class="grid grid-cols-2 gap-3">
							<el-form-item label="Heating setpoint (°C)">
								<el-input-number
									v-model="draft.policy.heatingSetpoint"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Cooling setpoint (°C)">
								<el-input-number
									v-model="draft.policy.coolingSetpoint"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Cold tolerance (°C)">
								<el-input-number
									v-model="draft.policy.coldTolerance"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Hot tolerance (°C)">
								<el-input-number
									v-model="draft.policy.hotTolerance"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Neutral heat/cool margin (°C)">
								<el-input-number
									v-model="draft.policy.neutralMargin"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Minimum OFF interval (ms)">
								<el-input-number
									v-model="draft.policy.minimumOffMs"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Changeover interval (ms)">
								<el-input-number
									v-model="draft.policy.changeoverMs"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
						</div>
						<el-checkbox
							:model-value="draft.policy.floor !== null"
							@change="toggleFloor"
						>
							Protect heating with floor temperature
						</el-checkbox>
						<div
							v-if="draft.policy.floor"
							class="grid grid-cols-2 gap-3"
						>
							<el-form-item label="Floor maximum (°C)">
								<el-input-number
									v-model="draft.policy.floor.limit"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Floor recovery hysteresis (°C)">
								<el-input-number
									v-model="draft.policy.floor.recoveryHysteresis"
									:controls="false"
								/>
							</el-form-item>
						</div>
						<el-checkbox
							:model-value="draft.heuristic !== null"
							@change="toggleTrend"
						>
							Use ambient trend to infer open window without contact
						</el-checkbox>
						<div
							v-if="draft.heuristic"
							class="grid grid-cols-2 gap-3"
						>
							<el-form-item
								v-for="field in trendFields"
								:key="field.key"
								:label="field.label"
							>
								<el-input-number
									v-model="draft.heuristic[field.key]"
									:controls="false"
								/>
							</el-form-item>
						</div>
						<div class="grid grid-cols-2 gap-3">
							<el-form-item label="Contact opening debounce (ms)">
								<el-input-number
									v-model="draft.contact_opening_ms"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
							<el-form-item label="Contact closing debounce (ms)">
								<el-input-number
									v-model="draft.contact_closing_ms"
									:min="0"
									:controls="false"
								/>
							</el-form-item>
						</div>
					</el-form>
				</div>
				<div v-show="at(1)">
					<el-divider content-position="left">Temperature and contact sources</el-divider>
					<el-checkbox
						v-if="configuration?.sources.some((entry) => entry.role === 'floor')"
						v-model="removeLegacyFloor"
					>
						{{ memberLabel('removeLegacyGuard') }}
					</el-checkbox>
					<p class="text-sm">Select original-age-qualified sources. Floor is an independent Celsius protection input; contact is optional.</p>
					<div
						v-for="(source, index) in draft.sources"
						:key="source.id ?? index"
						class="border rounded p-3 mb-2"
					>
						<div class="flex items-center justify-between mb-2">
							<strong>
								{{ source.role }}
								<small v-if="source.id">· {{ source.id }}</small>
							</strong>
							<el-button
								type="danger"
								link
								:disabled="source.role === 'floor' && !!configuration?.sources.some((entry) => entry.role === 'floor') && !removeLegacyFloor"
								@click="draft.sources.splice(index, 1)"
							>
								Remove
							</el-button>
						</div>
						<thermostat-property-picker
							v-model="source.source_property"
							:kind="source.role"
						/>
						<el-form-item
							label="Maximum original sample age (seconds)"
							class="mt-2"
						>
							<el-input-number
								v-model="source.maximum_age_seconds"
								:min="1"
								:controls="false"
							/>
						</el-form-item>
						<div
							v-if="source.role === 'contact'"
							class="grid grid-cols-2 gap-3"
						>
							<el-form-item label="Open value (JSON literal or text)">
								<el-input
									:model-value="formatContactValue(source.open_value)"
									@update:model-value="setContactValue(source, 'open_value', $event)"
								/>
							</el-form-item>
							<el-form-item label="Closed value (JSON literal or text)">
								<el-input
									:model-value="formatContactValue(source.closed_value)"
									@update:model-value="setContactValue(source, 'closed_value', $event)"
								/>
							</el-form-item>
						</div>
					</div>
					<div class="flex gap-2">
						<el-button @click="addSource(ThermostatSourceRole.ambient)">Add ambient</el-button>
						<el-button
							:disabled="draft.sources.some((source) => source.role === 'floor')"
							@click="addSource(ThermostatSourceRole.floor)"
						>
							Add floor
						</el-button>
						<el-button
							:disabled="draft.sources.some((source) => source.role === 'contact')"
							@click="addSource(ThermostatSourceRole.contact)"
						>
							Add contact
						</el-button>
					</div>
				</div>
				<div v-show="at(2)">
					<virtual-cooling-policy-editor
						v-model:draft="draft"
						:disabled="busy"
					/>
					<el-divider content-position="left">{{ memberLabel('members') }} · {{ draft.actuators.length }}/8</el-divider>
					<p>{{ memberLabel('mandatoryHelp') }}</p>
					<p>{{ memberLabel('nativeUnavailable') }}</p>
					<section
						v-for="role in [ThermostatActuatorRole.heating, ThermostatActuatorRole.cooling]"
						:key="role"
					>
						<h3>{{ role }}</h3>
						<thermostat-member-card
							v-for="(actuator, index) in draft.actuators.filter((member) => member.role === role)"
							:key="actuator.retained?.id ?? `${role}-${index}`"
							:member="actuator"
							:parallel="draft.actuators.filter((member) => member.role === 'heating').length > 1"
							:controller="deviceId"
							:configuration-revision="configuration?.revision ?? 0"
							:requested-limit="draft.policy.floor?.limit ?? null"
							:disabled="busy"
							:runtime="memberRuntime.value.value?.snapshot.branches.find((branch) => branch.claim === actuator.retained?.id) ?? null"
							:setup-disabled="!!configuration && JSON.stringify(draft) !== JSON.stringify(draftFromConfiguration(configuration))"
							:freshness="memberFreshness"
							:received-at="memberRuntime.value.value?.receivedAt ?? now"
							:now="now"
							@remove="draft.actuators.splice(draft.actuators.indexOf(actuator), 1)"
							@changed="reload"
						/>
						<el-button
							:disabled="busy || draft.actuators.length >= 8"
							@click="addActuator(role)"
						>
							{{ memberLabel('addMember') }} · {{ role }}
						</el-button>
					</section>
					<el-form-item :label="memberLabel('displayFloor')">
						<el-select
							v-model="draft.display_floor_claim"
							clearable
						>
							<el-option
								v-for="member in draft.actuators.filter((member) => member.retained?.protection)"
								:key="member.retained!.id"
								:value="member.retained!.id"
								:label="`${member.role} · ${member.retained!.physical_identity}`"
							/>
						</el-select>
					</el-form-item>
					<details v-if="configuration?.released_actuators?.length">
						<summary>{{ memberLabel('releasedHistory') }}</summary>
						<pre
							v-for="claim in configuration.released_actuators"
							:key="claim.id"
							>{{ JSON.stringify(claim, null, 2) }}</pre
						>
					</details>
				</div>
				<div v-show="at(0)">
					<el-divider content-position="left">Owned local command settings</el-divider>
					<p
						v-if="create"
						class="text-sm"
					>
						The controller creates local mode, setpoint and lock slots together with their registrations.
					</p>
					<div
						v-for="(setting, index) in create ? [] : draft.settings"
						:key="setting.setting"
						class="flex items-center gap-2 mb-2"
					>
						<el-select
							v-model="setting.setting"
							class="w-48"
						>
							<el-option
								v-for="settingName in settingNames"
								:key="settingName"
								:value="settingName"
								:label="settingName"
							/>
						</el-select>
						<thermostat-property-picker
							v-model="setting.property"
							:owner-device-id="deviceId"
							kind="setting"
						/>
						<el-button
							type="danger"
							link
							@click="draft.settings.splice(index, 1)"
						>
							Remove
						</el-button>
					</div>
					<el-button
						v-if="!create"
						@click="addSetting"
					>
						Add setting
					</el-button>
				</div>
				<div v-show="at(3)">
					<el-divider v-if="!create" />
					<el-descriptions
						v-if="create"
						:column="1"
						border
						class="mb-3"
						data-test-id="thermostat-summary"
					>
						<el-descriptions-item label="Thermostat name">{{ name }}</el-descriptions-item>
						<el-descriptions-item label="Requested mode">{{ draft.requested_mode }}</el-descriptions-item>
						<el-descriptions-item label="Setpoints (°C)">
							heating {{ draft.policy.heatingSetpoint ?? '—' }} · cooling {{ draft.policy.coolingSetpoint ?? '—' }}
						</el-descriptions-item>
						<el-descriptions-item label="Tolerances (°C)">
							cold {{ draft.policy.coldTolerance ?? '—' }} · hot {{ draft.policy.hotTolerance ?? '—' }} · neutral margin
							{{ draft.policy.neutralMargin ?? '—' }}
						</el-descriptions-item>
						<el-descriptions-item label="Timing (ms)">
							minimum OFF {{ draft.policy.minimumOffMs ?? '—' }} · changeover {{ draft.policy.changeoverMs ?? '—' }}
						</el-descriptions-item>
						<el-descriptions-item label="Sources">{{ draft.sources.map((source) => source.role).join(', ') || '—' }}</el-descriptions-item>
						<el-descriptions-item label="Actuator members">
							{{ draft.actuators.map((member) => member.role).join(', ') || '—' }}
						</el-descriptions-item>
					</el-descriptions>
					<el-alert
						v-for="reason in validationErrors"
						:key="reason"
						type="warning"
						:closable="false"
						:title="reason"
						class="mb-2"
					/>
					<el-alert
						v-if="requestError"
						type="error"
						:closable="false"
						:title="requestError"
						class="mb-2"
					/>
					<el-alert
						v-if="preview"
						:type="preview.reasons.length ? 'warning' : 'success'"
						:closable="false"
						:title="`Preview: ${preview.readiness}; ${preview.reasons.length} blocker(s)`"
						class="mb-2"
					>
						<ul>
							<li
								v-for="reason in preview.reasons"
								:key="reason"
							>
								{{ reason }}
							</li>
						</ul>
					</el-alert>
				</div>
				<template #final>
					<div class="flex gap-2">
						<!-- The review step previews by itself; the button is only the way to take a fresh one. -->
						<el-button
							v-if="!create || (!preview && validationErrors.length === 0)"
							:loading="busy"
							:disabled="validationErrors.length > 0"
							@click="runPreview"
						>
							Preview eligibility and claims
						</el-button>
						<el-button
							type="primary"
							:loading="busy"
							:disabled="!preview || !canSavePreview || validationErrors.length > 0"
							@click="save"
						>
							{{ create ? 'Create thermostat' : 'Save configuration' }}
						</el-button>
						<el-button
							v-if="configuration?.actuators.length"
							type="warning"
							:loading="busy"
							@click="requestRelease"
						>
							Request OFF and release
						</el-button>
						<el-button
							v-if="!create"
							@click="reload"
						>
							Reload
						</el-button>
					</div>
				</template>
			</virtual-wizard-steps>
		</template>
	</el-card>
	<virtual-thermostat-comfort
		v-if="!create && deviceId && configuration"
		:key="deviceId"
		:device-id="deviceId"
		:revision="configuration.revision"
		:disabled="busy || JSON.stringify(draft) !== JSON.stringify(draftFromConfiguration(configuration))"
		@changed="reload"
	/>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElDescriptions,
	ElDescriptionsItem,
	ElDivider,
	ElForm,
	ElFormItem,
	ElInput,
	ElInputNumber,
	ElOption,
	ElSelect,
	vLoading,
} from 'element-plus';

import { PLUGINS_PREFIX } from '../../../app.constants';
import { getErrorReason, injectSockets, useBackend } from '../../../common';
import { useSession } from '../../../modules/auth/composables/useSession';
import {
	SpacesModuleClimateIntentMode,
	DevicesVirtualPluginThermostatActuatorRole as ThermostatActuatorRole,
	DevicesVirtualPluginThermostatSettingSetting as ThermostatSettingRole,
	DevicesVirtualPluginThermostatSourceRole as ThermostatSourceRole,
	type operations,
} from '../../../openapi';
import { useThermostatMemberContext } from '../composables/use-thermostat-member-context';
import { useThermostatPreviewGate } from '../composables/use-thermostat-preview-gate';
import { DEVICES_VIRTUAL_PLUGIN_PREFIX } from '../devices-virtual.constants';
import {
	RECOMMENDED_ACTUATOR_LEASE_SECONDS,
	RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
	type ThermostatConfiguration,
	type ThermostatDraft,
	type ThermostatSource,
	buildThermostatRequest,
	draftAfterRelease,
	draftFromConfiguration,
	emptyThermostatDraft,
	newThermostatDraft,
} from '../services/thermostat-authoring';
import { ThermostatMemberFreshness } from '../services/thermostat-members';
import { thermostatDeviceDraft } from '../utils/thermostat-device-draft';

import ThermostatMemberCard from './thermostat-member-card.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';
import VirtualCoolingPolicyEditor from './virtual-cooling-policy-editor.vue';
import VirtualThermostatComfort from './virtual-thermostat-comfort.vue';
import VirtualWizardSteps from './wizard/virtual-wizard-steps.vue';

const props = defineProps<{ deviceId?: string; create?: boolean }>();
const emit = defineEmits<{ created: [deviceId: string] }>();
const backend = useBackend();
const sockets = injectSockets();
let alive = true;
const { profile } = useSession();
const canAuthor = computed(() => ['owner', 'admin'].includes(profile.value?.role ?? ''));
const { t } = useI18n();
const memberLabel = (key: string) => t(`devicesVirtualPlugin.members.${key}`);
const removeLegacyFloor = ref(false),
	now = ref(Date.now());
const configuration = ref<ThermostatConfiguration | null>(null);
const memberFreshness = new ThermostatMemberFreshness();
let retainedRuntimeClaims: string[] = [];
const memberRuntime = useThermostatMemberContext(
	computed(() => (props.deviceId && configuration.value ? `${props.deviceId}:${configuration.value.revision}` : '')),
	async (_, signal) => {
		const { data, error } = await backend.client.GET('/plugins/devices-virtual/producers/thermostats/{id}/runtime', {
			params: { path: { id: props.deviceId! } },
			signal,
		});
		if (!data) throw new Error(JSON.stringify(error));
		if (data.data.configuration_revision !== configuration.value?.revision) throw new Error('configuration_revision_changed');
		return { snapshot: data.data, receivedAt: Date.now() };
	}
);
watch([configuration, memberRuntime.value], ([config, runtime]) => {
	if (runtime) {
		retainedRuntimeClaims = runtime.snapshot.branches.filter((branch) => branch.claim_state !== 'released').map((branch) => branch.claim);
	}
	if (!config) return;
	memberFreshness.retain([...config.actuators.filter((claim) => claim.state !== 'released').map((claim) => claim.id), ...retainedRuntimeClaims]);
});
const clock = setInterval(() => {
	now.value = Date.now();
	memberFreshness.expire(now.value);
}, 1000);
const disconnectMembers = () => memberRuntime.invalidate();
const refreshMembers = () => {
	void memberRuntime.reload();
};
const memberHint = (event: { event: string; payload: unknown }) => {
	if (
		event.event === 'DevicesVirtualPlugin.Thermostat.RuntimeChanged' &&
		event.payload &&
		typeof event.payload === 'object' &&
		'controller' in event.payload &&
		event.payload.controller === props.deviceId
	)
		refreshMembers();
};
onMounted(() => {
	sockets.on('event', memberHint);
	sockets.on('connect', refreshMembers);
	sockets.on('disconnect', disconnectMembers);
});
onBeforeUnmount(() => {
	alive = false;
	clearInterval(clock);
	requestSequence++;
	sockets.off('event', memberHint);
	sockets.off('connect', refreshMembers);
	sockets.off('disconnect', disconnectMembers);
});
const preview = ref<ThermostatConfiguration | null>(null);
const draft = ref(props.create ? newThermostatDraft() : emptyThermostatDraft());
const name = ref('');
const graph = ref<ReturnType<typeof thermostatDeviceDraft> | null>(null);
let graphBranchSignature = '';
const creationGraph = () => {
	const signature = `${draft.value.policy.heatingSetpoint !== null}:${draft.value.policy.coolingSetpoint !== null}`;
	if (!graph.value || graphBranchSignature !== signature) {
		graph.value = thermostatDeviceDraft(name.value, draft.value.policy.heatingSetpoint !== null, draft.value.policy.coolingSetpoint !== null);
		graphBranchSignature = signature;
	}
	graph.value.device.name = name.value.trim();
	return graph.value;
};
const payload = () =>
	buildThermostatRequest(
		props.create ? { ...draft.value, settings: creationGraph().settings } : draft.value,
		configuration.value?.revision ?? 0,
		configuration.value?.graph_revision ?? preview.value?.graph_revision
	);
const loading = ref(false);
const mutationBusy = ref(false);
const previewBusy = ref(false);
const busy = computed(() => mutationBusy.value || previewBusy.value);
const loadError = ref<string | null>(null);
const requestError = ref<string | null>(null);
const previewGate = useThermostatPreviewGate(
	() =>
		JSON.stringify({ draft: draft.value, name: name.value, create: props.create, deviceId: props.deviceId, revision: configuration.value?.revision }),
	[draft, name, () => props.create, () => props.deviceId, () => configuration.value?.revision],
	() => {
		preview.value = null;
		previewBusy.value = false;
	}
);
const canSavePreview = previewGate.canSave;
const validationErrors = computed(() => [
	...(props.create && !name.value.trim() ? ['Enter a thermostat name.'] : []),
	...(configuration.value?.sources.some((source) => source.role === 'floor') &&
	!draft.value.sources.some((source) => source.role === 'floor') &&
	!removeLegacyFloor.value
		? [memberLabel('removeLegacyGuard')]
		: []),
	...payload().errors.map((error) => (error.startsWith('devicesVirtualPlugin.') ? t(error) : error)),
]);
// Creation walks the form in four steps — settings, sources, actuators, review — one section at a
// time; an existing thermostat keeps the single page. What is still missing is listed on the review
// step only: a new thermostat is incomplete by definition, and reciting that on every earlier step
// reads as the form scolding the user for opening it. Preview and Create stay gated on the full list.
const step = ref(0);
const REVIEW_STEP = 3;
const at = (index: number): boolean => !props.create || step.value === index;
const stepLabels = computed<string[]>(() =>
	['settings', 'sources', 'actuators', 'review'].map((key) => t(`devicesVirtualPlugin.wizard.steps.${key}`))
);
// Each step asks for the one thing the later steps cannot do without; the review step still lists
// every remaining problem in full.
const canAdvance = computed<boolean>(() => {
	const { policy, sources, actuators } = draft.value;
	if (step.value === 0) return !!name.value.trim() && (policy.heatingSetpoint !== null || policy.coolingSetpoint !== null);
	if (step.value === 1) return sources.some((source) => source.role === 'ambient' && !!source.source_property);
	return actuators.length > 0 && actuators.every((member) => !!member.source_property);
});
watch(step, (value) => {
	if (props.create && value === REVIEW_STEP && validationErrors.value.length === 0) void runPreview();
});
const modeNames = Object.values(SpacesModuleClimateIntentMode);
const settingNames = Object.values(ThermostatSettingRole);
type TrendKey = keyof NonNullable<typeof draft.value.heuristic>;
const trendFields: { key: TrendKey; label: string }[] = [
	{ key: 'sampleWindowMs', label: 'Sample window (ms)' },
	{ key: 'minimumSamples', label: 'Minimum samples' },
	{ key: 'minimumSpanMs', label: 'Minimum span (ms)' },
	{ key: 'maximumSampleAgeMs', label: 'Maximum sample age (ms)' },
	{ key: 'slopeThresholdCPerMinute', label: 'Slope threshold (°C/min)' },
	{ key: 'confirmationMs', label: 'Confirmation (ms)' },
	{ key: 'recoveryMs', label: 'Recovery (ms)' },
	{ key: 'maximumPauseMs', label: 'Maximum pause (ms)' },
	{ key: 'cooldownMs', label: 'Cooldown (ms)' },
];

let requestSequence = 0;
const path = `/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats/{id}` as const;
const reload = async (): Promise<void> => {
	if (props.create || !props.deviceId) return;
	const sequence = ++requestSequence;
	mutationBusy.value = false;
	loading.value = true;
	loadError.value = null;
	previewGate.invalidate();
	try {
		const { data, error, response } = await backend.client.GET(path, { params: { path: { id: props.deviceId } } });
		if (!alive || sequence !== requestSequence) return;
		if (response.status === 404) {
			configuration.value = null;
			draft.value = emptyThermostatDraft();
		} else if (data) {
			configuration.value = data.data;
			draft.value = draftFromConfiguration(data.data);
		} else
			loadError.value = getErrorReason<operations['get-devices-virtual-plugin-thermostat-configuration']>(
				error,
				'Could not load thermostat configuration.'
			);
	} catch (error) {
		if (sequence === requestSequence) loadError.value = String(error);
	} finally {
		if (sequence === requestSequence) loading.value = false;
	}
};
const errorText = (error: unknown): string => {
	if (typeof error === 'object' && error !== null && 'message' in error) {
		const message = (error as { message: unknown }).message;
		if (typeof message === 'string') return message;
		if (Array.isArray(message)) return message.join('; ');
	}
	// The backend's own refusal travels as `error.details.reason`; without reading it every rejected
	// preview or save collapsed into the same sentence and gave no hint of what to change.
	return getErrorReason(error as Parameters<typeof getErrorReason>[0], 'Thermostat request failed.');
};
const runPreview = async (): Promise<void> => {
	if (mutationBusy.value || !canAuthor.value) return;
	const result = payload();
	if (!result.request) return;
	const request = {
		create: props.create,
		configuration: result.request,
		device: props.create ? creationGraph().device : null,
		deviceId: props.deviceId,
	};
	requestError.value = null;
	await previewGate.execute(
		request,
		async (snapshot) => {
			const { data, error } = snapshot.create
				? await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats/draft-preview`, {
						body: { device: snapshot.device!, configuration: snapshot.configuration },
					})
				: await backend.client.POST(`${path}/preview`, { params: { path: { id: snapshot.deviceId! } }, body: snapshot.configuration });
			if (!data) throw new Error(errorText(error));
			return data.data;
		},
		{
			success: (result) => (preview.value = result),
			error: (error) => (requestError.value = errorText(error)),
			pending: (pending) => (previewBusy.value = pending),
		}
	);
};
const save = async (): Promise<void> => {
	if (!canAuthor.value || !preview.value || !previewGate.canSave.value || busy.value) return;
	const result = payload();
	if (!result.request) return;
	const identity = props.deviceId,
		ticket = ++requestSequence,
		draftSignature = JSON.stringify(draft.value);
	mutationBusy.value = true;
	requestError.value = null;
	try {
		if (props.create) {
			const { data, error } = await backend.client.POST(`/${PLUGINS_PREFIX}/${DEVICES_VIRTUAL_PLUGIN_PREFIX}/producers/thermostats`, {
				body: { device: creationGraph().device, configuration: result.request },
			});
			if (!alive || ticket !== requestSequence) return;
			if (data) emit('created', data.data.device.id);
			else requestError.value = errorText(error);
			return;
		}
		const { data, error } = await backend.client.PUT(path, { params: { path: { id: props.deviceId! } }, body: result.request });
		if (!alive || ticket !== requestSequence || identity !== props.deviceId) return;
		if (data) {
			configuration.value = data.data;
			if (JSON.stringify(draft.value) === draftSignature) draft.value = draftFromConfiguration(data.data);
			preview.value = null;
		} else requestError.value = errorText(error);
	} catch (error) {
		if (alive && ticket === requestSequence) requestError.value = errorText(error);
	} finally {
		if (alive && ticket === requestSequence) mutationBusy.value = false;
	}
};
const requestRelease = async (): Promise<void> => {
	const deviceId = props.deviceId;
	if (!canAuthor.value || !configuration.value || !deviceId || busy.value) return;
	const ticket = ++requestSequence,
		draftSignature = JSON.stringify(draftFromConfiguration(configuration.value));
	mutationBusy.value = true;
	requestError.value = null;
	try {
		const { data, error } = await backend.client.POST(`${path}/release`, {
			params: { path: { id: deviceId } },
			body: { expected_revision: configuration.value.revision },
		});
		if (!alive || ticket !== requestSequence || deviceId !== props.deviceId) return;
		if (data) {
			configuration.value = data.data;
			draft.value = JSON.stringify(draft.value) === draftSignature ? draftFromConfiguration(data.data) : draftAfterRelease(draft.value, data.data);
			previewGate.invalidate();
			preview.value = null;
			memberRuntime.invalidate();
			void memberRuntime.reload();
		} else requestError.value = errorText(error);
	} catch (error) {
		if (alive && ticket === requestSequence) requestError.value = errorText(error);
	} finally {
		if (alive && ticket === requestSequence) mutationBusy.value = false;
	}
};
const toggleFloor = (enabled: string | number | boolean): void => {
	if (
		enabled !== true &&
		(draft.value.actuators.some((member) => !!member.protection) || draft.value.sources.some((source) => source.role === 'floor'))
	)
		return;
	draft.value.policy.floor = enabled === true ? { limit: null, recoveryHysteresis: null } : null;
};
const toggleTrend = (enabled: string | number | boolean): void => {
	draft.value.heuristic =
		enabled === true ? (Object.fromEntries(trendFields.map((field) => [field.key, null])) as NonNullable<typeof draft.value.heuristic>) : null;
};
const addSource = (role: ThermostatSource['role']): void => {
	draft.value.sources.push({ role, source_property: null, maximum_age_seconds: props.create ? RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS : null });
};
const addActuator = (role: ThermostatActuatorRole): void => {
	if (draft.value.actuators.length >= 8 || !canAuthor.value) return;
	draft.value.actuators.push({ role, source_property: '', lease_seconds: props.create ? RECOMMENDED_ACTUATOR_LEASE_SECONDS : null });
};
const addSetting = (): void => {
	draft.value.settings.push({ setting: ThermostatSettingRole.heating_setpoint, property: '' });
};
const formatContactValue = (value: unknown): string => (value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value));
const setContactValue = (source: ThermostatDraft['sources'][number], key: 'open_value' | 'closed_value', value: string): void => {
	try {
		source[key] = JSON.parse(value) as string | number | boolean;
	} catch {
		source[key] = value;
	}
};
watch(
	() => props.deviceId,
	() => {
		memberFreshness.clear();
		retainedRuntimeClaims = [];
		previewGate.invalidate();
		void reload();
	}
);
onMounted(() => {
	if (!props.create) void reload();
});
</script>
