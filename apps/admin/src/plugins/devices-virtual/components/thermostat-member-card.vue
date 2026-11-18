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
				v-model="member.source_property"
				kind="actuator"
			/>
		</el-form-item>
		<p v-else-if="member.retained">{{ label('retained') }}</p>
		<el-form-item
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
				{{ label('localProtection') }}
			</el-checkbox>
			<el-form-item
				v-if="floorSources !== undefined && parallel && !member.protection"
				:label="label('localProtection')"
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
				<el-alert
					v-for="reason in floorSources === undefined ? (context.value.value?.reasons ?? []) : []"
					:key="reason"
					:title="reason"
					type="warning"
					:closable="false"
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
		</template>
		<template v-if="member.retained">
			<p>{{ label('observed') }}: {{ observation.activity }} · {{ label('pendingOn') }}: {{ runtime?.pending_on ?? 'unknown' }}</p>
			<p>{{ label('qualification') }}: {{ observation.qualification ?? 'unknown' }}</p>
			<p>{{ label('qualificationHelp') }}</p>
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
			<details>
				<summary>{{ label('proof') }}</summary>
				<pre>{{ JSON.stringify(runtime?.release_evidence ?? member.retained.release_evidence, null, 2) }}</pre>
			</details>
			<thermostat-member-installation
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
import { useVirtualWizardError } from '../composables/use-virtual-wizard-error';
import { RECOMMENDED_SOURCE_MAXIMUM_AGE_SECONDS, type ThermostatMemberDraft } from '../services/thermostat-authoring';
import { type ThermostatMemberContext, ThermostatMemberFreshness, type ThermostatMemberRuntime } from '../services/thermostat-members';

import ThermostatMemberInstallation from './thermostat-member-installation.vue';
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
	parallel: boolean;
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
const sourceKey = computed(() =>
	props.member.source_property &&
	(props.floorSources === undefined ||
		(props.member.role === 'heating' && props.floorSources.length > 0) ||
		(props.member.role === 'cooling' && props.coolingSources?.some((source) => source.role === 'cooled_surface')))
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
const candidates = computed(() =>
	(context.value.value?.candidates ?? []).filter(
		(candidate) => props.floorSources === undefined || props.floorSources.some((source) => source.id === candidate.property)
	)
);
const selected = computed(() => candidates.value.find((entry) => entry.property === props.member.protection?.source_property));
// Only newly authored guards are derived from the wizard selection. Never detach an installed guard.
watch(
	[candidates, () => props.floorSources],
	() => {
		if (props.floorSources === undefined || member.value.retained || member.value.role !== 'heating') return;
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
const coolingSurfaces = computed(
	() =>
		props.coolingSources?.filter(
			(source) => source.role === 'cooled_surface' && context.value.value?.candidates.some((candidate) => candidate.property === source.id)
		) ?? []
);
watch(
	[() => props.coolingSources, () => context.value.value],
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
	else if (enabled !== true && !member.value.retained?.protection && !props.parallel) delete member.value.protection;
};
const selectSource = (value: string) => {
	if (member.value.protection && candidates.value.some((entry) => entry.property === value)) member.value.protection.source_property = value;
};
useVirtualWizardError(context.error);
defineExpose({ loading: context.loading });
</script>
