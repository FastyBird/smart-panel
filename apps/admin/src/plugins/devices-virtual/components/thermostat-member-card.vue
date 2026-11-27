<template>
	<virtual-wizard-card
		v-loading="floorSources !== undefined && context.loading.value"
		shadow="never"
		class="mb-3"
		data-test-id="thermostat-member"
	>
		<template #header>
			<div class="flex items-center justify-between gap-3">
				<strong>{{ title ?? `${label('mandatory')} · ${member.role} · ${member.retained?.id ?? label('newMember')}` }}</strong>
				<virtual-wizard-remove-button
					v-if="!member.retained && selectable !== false"
					:disabled="disabled"
					:label="label('removeDraft')"
					@click="emit('remove')"
				/>
			</div>
		</template>
		<p v-if="member.retained">{{ member.retained.physical_identity }} · {{ member.retained.state }} · {{ member.retained.source_identity }}</p>
		<el-form-item
			v-if="!member.retained && selectable !== false"
			:error="fieldError(`actuatorRepair:${member.role}`)"
			:label="t('devicesVirtualPlugin.measurement.selectSource')"
			required
		>
			<thermostat-property-picker
				:model-value="member.source_property"
				kind="actuator"
				@update:model-value="selectOutput"
			/>
		</el-form-item>
		<p v-else-if="member.retained">{{ label('retained') }}</p>
		<template v-if="member.source_property">
			<el-form-item
				v-if="(extensions.length || !supervised) && !member.retained"
				:label="label('profile')"
			>
				<el-select
					:model-value="profile"
					:disabled="disabled || context.loading.value"
					data-test-id="member-safety-profile"
					@change="selectProfile"
				>
					<el-option
						:value="SUPERVISED_SWITCH_PROFILE"
						:label="label('supervised')"
					/>
					<el-option
						v-if="!supervised && !selectedExtension"
						:value="profile"
						:label="profile"
						disabled
					/>
					<el-option
						v-for="extension in extensions"
						:key="extension.id"
						:value="extension.id"
						:label="extension.name"
					/>
				</el-select>
			</el-form-item>
			<p v-else-if="!supervised">{{ selectedExtension?.name ?? profile }}</p>
			<template v-if="supervised">
				<el-alert
					:title="label('noFailsafe')"
					type="warning"
					show-icon
					:closable="false"
				/>
				<el-form-item
					:error="!member.independent_protection_acknowledged ? fieldError(`independentProtection:${member.role}`) : ''"
					class="mt-2"
				>
					<el-checkbox
						v-model="member.independent_protection_acknowledged"
						:disabled="disabled"
						data-test-id="independent-protection"
					>
						{{ label('acknowledgeProtection') }}
					</el-checkbox>
				</el-form-item>
			</template>
			<el-alert
				v-else-if="!selectedExtension && !context.loading.value"
				:title="label('extensionUnavailable')"
				type="warning"
				:closable="false"
			/>
			<el-alert
				v-for="reason in authoringReasons"
				:key="reason"
				:title="reason"
				type="warning"
				:closable="false"
			/>
		</template>
		<el-form-item
			v-if="!supervised"
			:error="!Number.isFinite(member.lease_seconds) || member.lease_seconds! <= 0 ? fieldError(`lease:${member.role}`) : ''"
			:label="label('lease')"
			required
		>
			<el-input-number
				v-model="member.lease_seconds"
				:disabled="disabled"
				:controls="false"
			/>
		</el-form-item>
		<template v-if="member.role === 'heating'">
			<el-checkbox
				v-if="floorSources === undefined"
				:model-value="!!member.protection"
				:disabled="disabled || !!member.retained?.protection"
				@change="adopt"
			>
				{{ label('memberFloor') }}
			</el-checkbox>
			<el-form-item
				v-if="floorSources !== undefined && !supervised && floorSources.length && !member.protection"
				:label="label('memberFloor')"
				:error="fieldError('localProtection')"
				required
			>
				<span v-if="!context.loading.value">{{ label('selectedFloorRequired') }}</span>
			</el-form-item>
			<template v-if="member.protection">
				<p v-if="member.retained?.protection">
					{{ label('retainedSource') }}: {{ member.retained.protection.source_identity }} · {{ member.retained.protection.physical_property }} · r{{
						member.retained.protection.revision
					}}
				</p>
				<el-form-item
					:label="label('localSource')"
					:error="fieldError('localProtection')"
					required
				>
					<el-select
						:model-value="member.protection.source_property"
						:disabled="disabled || context.loading.value"
						:loading="context.loading.value"
						:placeholder="label('localSource')"
						@change="selectSource"
					>
						<el-option
							v-for="candidate in candidates"
							:key="candidate.property"
							:label="floorSources?.find((source) => source.id === candidate.property)?.label ?? candidate.name"
							:value="candidate.property"
						/>
					</el-select>
				</el-form-item>
				<el-form-item
					:error="fieldError('protectionAge')"
					:label="label('maximumAge')"
					required
				>
					<el-input-number
						v-model="member.protection.maximum_age_seconds"
						:disabled="disabled"
						:controls="false"
						:min="1"
					/>
				</el-form-item>
				<source-reporting
					v-if="!disabled"
					:properties="[member.protection.source_property]"
					:maximum-age-seconds="member.protection.maximum_age_seconds"
					consequence="floor"
					@apply="member.protection.maximum_age_seconds = $event"
				/>

				<el-alert
					v-if="member.protection.source_property && !context.loading.value && !selected"
					:title="label('sourceMismatch')"
					type="warning"
					:closable="false"
				/>
				<details v-if="selected && floorSources === undefined">
					<summary>{{ label('snapshot') }}</summary>
					<pre class="overflow-auto">{{ JSON.stringify(selected.snapshot, null, 2) }}</pre>
				</details>
			</template>
		</template>
		<template v-if="member.role === 'cooling' && coolingSources !== undefined && member.cooling_protection">
			<el-form-item
				:label="t('devicesVirtualPlugin.dewPoint.title')"
				:error="fieldError('coolingDependencies')"
				required
			>
				<el-select
					v-model="member.cooling_protection.dew_point_property"
					:disabled="disabled"
					:placeholder="t('devicesVirtualPlugin.measurement.selectSource')"
					data-test-id="cooling-dew-point-picker"
				>
					<el-option
						v-for="source in coolingDewPoints"
						:key="source.id"
						:value="source.id"
						:label="source.label"
					/>
				</el-select>
			</el-form-item>
			<el-form-item
				:label="t('devicesVirtualPlugin.dewPoint.surface')"
				:error="fieldError('coolingDependencies')"
				required
			>
				<el-select
					v-model="member.cooling_protection.surface_property"
					:disabled="disabled || context.loading.value"
					:loading="context.loading.value"
					:placeholder="t('devicesVirtualPlugin.measurement.selectSource')"
					data-test-id="cooling-surface-picker"
				>
					<el-option
						v-for="source in coolingSurfaces"
						:key="source.id"
						:value="source.id"
						:label="source.label"
					/>
				</el-select>
				<span v-if="!context.loading.value && !coolingSurfaces.length">{{ t('devicesVirtualPlugin.thermostat.wizard.coolingSurfaceRequired') }}</span>
			</el-form-item>
			<el-form-item
				:label="t('devicesVirtualPlugin.measurement.maximumAge')"
				:error="fieldError('coolingDependencies')"
				required
			>
				<el-input-number
					v-model="member.cooling_protection.maximum_age_seconds"
					:min="1"
					:max="86400"
					:controls="false"
					:disabled="disabled"
				/>
			</el-form-item>
			<source-reporting
				v-if="!disabled"
				:properties="[member.cooling_protection.surface_property]"
				:maximum-age-seconds="member.cooling_protection.maximum_age_seconds"
				consequence="surface"
				@apply="member.cooling_protection.maximum_age_seconds = $event"
			/>
		</template>
		<template v-if="member.retained">
			<p>{{ label('observed') }}: {{ observation.activity }} · {{ label('pendingOn') }}: {{ runtime?.pending_on ?? 'unknown' }}</p>
			<p>{{ label('qualification') }}: {{ observation.qualification ?? 'unknown' }}</p>
			<p>{{ label(supervised ? 'supervisedQualification' : 'qualificationHelp') }}</p>
			<p>{{ label('activitySample') }}: {{ observation.sampledAt ?? '—' }} · {{ label('activityExpiry') }}: {{ observation.expiresAt ?? '—' }}</p>
			<p>
				{{ label('reading') }}: {{ reading.temperature === null ? label('unavailable') : `${reading.temperature} °C` }} · {{ reading.status }} ·
				{{ runtime?.protection?.quality ?? 'unavailable' }} · {{ reading.age ?? '—' }} s
			</p>
			<p>
				{{ label('cutoff') }}: {{ runtime?.protection?.effective_cutoff ?? '—' }} °C · {{ label('latched') }}:
				{{ reading.status === 'fresh' && reading.temperature !== null ? (runtime?.protection?.latched ?? 'unknown') : 'unknown' }}
			</p>
			<p>
				{{ label('release') }}: {{ runtime?.release_pending ?? 'unknown' }} · {{ runtime?.release_attempts ?? '—' }} ·
				{{ runtime?.next_release_at ?? '—' }} · {{ label('releaseProven') }}: {{ runtime?.release_proven ?? 'unknown' }} · {{ label('lastOff') }}:
				{{ runtime?.last_verified_off_at ?? '—' }}
			</p>
			<p>{{ label('generation') }}: {{ member.retained.qualification_generation ?? '—' }} · r{{ member.retained.revision }}</p>
			<el-alert
				v-for="reason in [...(runtime?.protection?.reasons ?? []), ...(runtime?.fault ? [runtime.fault] : [])]"
				:key="reason"
				:title="reason"
				type="warning"
				:closable="false"
			/>
			<el-alert
				v-if="runtime?.release_pending && !runtime.release_proven"
				:title="label('awaitingOff')"
				type="warning"
				:closable="false"
			/>
			<details>
				<summary>{{ label('proof') }}</summary>
				<pre>{{ JSON.stringify(runtime?.release_evidence ?? member.retained.release_evidence, null, 2) }}</pre>
			</details>
			<component
				:is="installationForm"
				v-if="installationForm && selectedExtension?.installation_path"
				:claim="member.retained"
				:configuration-revision="configurationRevision"
				:disabled="disabled || setupDisabled"
				:requested-limit="requestedLimit"
				@changed="emit('changed')"
			/>
			<thermostat-member-recovery
				v-if="member.retained.state !== 'reserved'"
				:claim="member.retained"
				:controller="controller"
				:configuration-revision="configurationRevision"
				:disabled="disabled || setupDisabled"
				@changed="emit('changed')"
			/>
		</template>
	</virtual-wizard-card>
</template>
<script setup lang="ts">
import { computed, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElCheckbox, ElFormItem, ElInputNumber, ElOption, ElSelect, vLoading } from 'element-plus';

import { useBackend } from '../../../common';
import { useWizardFieldError } from '../../../modules/devices/components/wizard/use-wizard-validation';
import { useThermostatMemberContext } from '../composables/use-thermostat-member-context';
import { useVirtualDeviceExtensions } from '../composables/use-virtual-device-extensions';
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import {
	RECOMMENDED_ACTUATOR_LEASE_SECONDS,
	RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
	SUPERVISED_SWITCH_PROFILE,
	type ThermostatMemberDraft,
	isSupervisedMember,
} from '../services/thermostat-authoring';
import { type ThermostatMemberContext, ThermostatMemberFreshness, type ThermostatMemberRuntime } from '../services/thermostat-members';

import SourceReporting from './source-reporting.vue';
import ThermostatMemberRecovery from './thermostat-member-recovery.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';
import VirtualWizardCard from './virtual-wizard-card.vue';
import VirtualWizardRemoveButton from './virtual-wizard-remove-button.vue';

const fieldError = useWizardFieldError();
const props = defineProps<{
	member: ThermostatMemberDraft;
	title?: string;
	selectable?: boolean;
	floorSources?: { id: string; label: string; maximumAgeSeconds: number | null }[];
	coolingSources?: { id: string; label: string; role: 'dew_point' | 'cooled_surface' }[];
	coolingEnabled?: boolean;
	controller?: string;
	configurationRevision: number;
	requestedLimit: number | null;
	disabled: boolean;
	setupDisabled?: boolean;
	runtime: ThermostatMemberRuntime | null;
	receivedAt: number;
	now: number;
	freshness?: ThermostatMemberFreshness;
}>();
const emit = defineEmits<{ remove: []; changed: [] }>();
const { t } = useI18n();
const label = (key: string) => t(`devicesVirtualPlugin.members.${key}`);
const backend = useBackend();
const member = toRef(props, 'member');
const { installation } = useVirtualDeviceExtensions();
const profile = computed(() => member.value.provider_profile ?? SUPERVISED_SWITCH_PROFILE);
const supervised = computed(() => isSupervisedMember(member.value));
const installationForm = computed(() => installation(profile.value));
const sourceKey = computed(() =>
	props.member.source_property
		? `${props.member.source_property}:${props.configurationRevision}:${props.member.retained?.revision ?? ''}:${props.member.retained?.qualification_generation ?? ''}`
		: ''
);
const context = useThermostatMemberContext<ThermostatMemberContext>(sourceKey, async (_, signal) => {
	const property = props.member.source_property!;
	const { data, error } = await backend.client.GET('/plugins/devices-virtual/producers/thermostat-member-authoring/actuators/{property}', {
		params: { path: { property } },
		signal,
	});
	if (!data) throw new Error(JSON.stringify(error));
	return data.data;
});
const extensions = computed(() =>
	(context.value.value?.safety_extensions ?? []).filter(
		(extension) => extension.roles.includes(member.value.role) && (!extension.requires_cooling_protection || props.coolingEnabled)
	)
);
const selectedExtension = computed(() => extensions.value.find((extension) => extension.id === profile.value));
const authoringReasons = computed(() => [...new Set([...(context.value.value?.reasons ?? []), ...(selectedExtension.value?.reasons ?? [])])]);
const protectionCandidates = computed(() =>
	supervised.value ? (context.value.value?.candidates ?? []) : (selectedExtension.value?.candidates ?? [])
);
const candidates = computed(() =>
	protectionCandidates.value.filter(
		(candidate) => props.floorSources === undefined || props.floorSources.some((source) => source.id === candidate.property)
	)
);
function selectProfile(id: string) {
	if (
		props.disabled ||
		member.value.retained ||
		id === profile.value ||
		(id !== SUPERVISED_SWITCH_PROFILE && !extensions.value.some((item) => item.id === id))
	)
		return;
	member.value.provider_profile = id;
	delete member.value.independent_protection_acknowledged;
	member.value.lease_seconds = id === SUPERVISED_SWITCH_PROFILE ? null : RECOMMENDED_ACTUATOR_LEASE_SECONDS;
	delete member.value.protection;
}
function selectOutput(id: string | null) {
	if (props.disabled || member.value.retained || id === member.value.source_property) return;
	member.value.source_property = id;
	delete member.value.provider_profile;
	delete member.value.independent_protection_acknowledged;
	member.value.lease_seconds = null;
	delete member.value.protection;
}
const selected = computed(() => candidates.value.find((entry) => entry.property === props.member.protection?.source_property));
// Only newly authored guards are derived from the wizard selection. Never detach an installed guard.
watch(
	[candidates, () => props.floorSources, profile],
	() => {
		if (props.floorSources === undefined || member.value.retained || member.value.role !== 'heating' || supervised.value) return;
		if (!props.floorSources.length) {
			delete member.value.protection;
			return;
		}
		if (!context.value.value) return;
		if (member.value.protection && !selected.value) delete member.value.protection;
		if (!member.value.protection && candidates.value.length === 1) {
			const source = props.floorSources.find((source) => source.id === candidates.value[0].property)!;
			member.value.protection = {
				schema_version: 1,
				kind: 'local_floor',
				source_property: source.id,
				maximum_age_seconds: source.maximumAgeSeconds ?? RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
			} as NonNullable<ThermostatMemberDraft['protection']>;
		}
	},
	{ immediate: true }
);
const coolingDewPoints = computed(() => props.coolingSources?.filter((source) => source.role === 'dew_point') ?? []);
const cooledSurfaceCandidates = computed(() =>
	selectedExtension.value?.requires_cooling_protection ? selectedExtension.value.candidates : (context.value.value?.candidates ?? [])
);
const coolingSurfaces = computed(
	() =>
		props.coolingSources?.filter(
			(source) => source.role === 'cooled_surface' && cooledSurfaceCandidates.value.some((candidate) => candidate.property === source.id)
		) ?? []
);
watch(
	[() => props.coolingSources, cooledSurfaceCandidates, profile],
	() => {
		if (props.coolingSources === undefined || member.value.retained || member.value.role !== 'cooling') return;
		const guard = (member.value.cooling_protection ??= {
			schemaVersion: 1,
			purpose: 'cooled_surface',
			dew_point_property: null,
			surface_property: null,
			maximum_age_seconds: 60,
		} as NonNullable<ThermostatMemberDraft['cooling_protection']>);
		if (guard.dew_point_property && !coolingDewPoints.value.some((source) => source.id === guard.dew_point_property)) guard.dew_point_property = null;
		if (!guard.dew_point_property && coolingDewPoints.value.length === 1) guard.dew_point_property = coolingDewPoints.value[0].id;
		if (guard.surface_property && !props.coolingSources.some((source) => source.role === 'cooled_surface' && source.id === guard.surface_property))
			guard.surface_property = null;
		if (!context.value.value) return;
		if (guard.surface_property && !coolingSurfaces.value.some((source) => source.id === guard.surface_property)) guard.surface_property = null;
		if (!guard.surface_property && coolingSurfaces.value.length === 1) guard.surface_property = coolingSurfaces.value[0].id;
	},
	{ immediate: true }
);
const localFreshness = new ThermostatMemberFreshness();
const claimKey = computed(() => props.member.retained?.id ?? props.member.source_property ?? 'unbound');
const observation = computed(() => (props.freshness ?? localFreshness).observation(claimKey.value, props.runtime, props.receivedAt, props.now));
const reading = computed(() => (props.freshness ?? localFreshness).reading(claimKey.value, props.runtime, props.receivedAt, props.now));
const adopt = (enabled: string | number | boolean) => {
	if (enabled === true && !member.value.protection)
		member.value.protection = {
			schema_version: 1,
			kind: 'local_floor',
			source_property: null,
			maximum_age_seconds: RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS,
		} as unknown as NonNullable<ThermostatMemberDraft['protection']>;
	else if (enabled !== true && !member.value.retained?.protection) delete member.value.protection;
};
const selectSource = (value: string) => {
	if (member.value.protection && candidates.value.some((entry) => entry.property === value)) member.value.protection.source_property = value;
};
useVirtualWizardError(context.error);
defineExpose({ loading: context.loading });
</script>
