<template>
	<el-card
		shadow="never"
		class="mb-3"
		data-test-id="thermostat-member"
	>
		<template #header>
			<strong>{{ label('mandatory') }} · {{ member.role }} · {{ member.retained?.id ?? label('newMember') }}</strong>
			<el-button
				v-if="!member.retained"
				:disabled="disabled"
				link
				type="danger"
				@click="emit('remove')"
			>
				{{ label('removeDraft') }}
			</el-button>
		</template>
		<p v-if="member.retained">{{ member.retained.physical_identity }} · {{ member.retained.state }} · {{ member.retained.source_identity }}</p>
		<thermostat-property-picker
			v-if="!member.retained"
			v-model="member.source_property"
			kind="actuator"
		/>
		<p v-else>{{ label('retained') }}</p>
		<el-form-item :label="label('lease')">
			<el-input-number
				v-model="member.lease_seconds"
				:disabled="disabled"
				:controls="false"
			/>
		</el-form-item>
		<template v-if="member.role === 'heating'">
			<el-checkbox
				:model-value="!!member.protection"
				:disabled="disabled || !!member.retained?.protection"
				@change="adopt"
			>
				{{ label('localProtection') }}
			</el-checkbox>
			<template v-if="member.protection">
				<p v-if="member.retained?.protection">
					{{ label('retainedSource') }}: {{ member.retained.protection.source_identity }} · {{ member.retained.protection.physical_property }} · r{{
						member.retained.protection.revision
					}}
				</p>
				<el-select
					:model-value="member.protection.source_property"
					:disabled="disabled || context.loading.value"
					:placeholder="label('localSource')"
					@change="selectSource"
				>
					<el-option
						v-for="candidate in context.value.value?.candidates ?? []"
						:key="candidate.property"
						:label="`${candidate.name} · ${candidate.physical_property}`"
						:value="candidate.property"
					/>
				</el-select>
				<el-form-item :label="label('maximumAge')">
					<el-input-number
						v-model="member.protection.maximum_age_seconds"
						:disabled="disabled"
						:controls="false"
						:min="1"
					/>
				</el-form-item>
				<el-alert
					v-for="reason in context.value.value?.reasons ?? []"
					:key="reason"
					:title="reason"
					type="warning"
					:closable="false"
				/>
				<el-alert
					v-if="context.error.value"
					:title="context.error.value"
					type="error"
					:closable="false"
				/>
				<el-alert
					v-if="member.protection.source_property && !context.loading.value && !selected"
					:title="label('sourceMismatch')"
					type="warning"
					:closable="false"
				/>
				<details v-if="selected">
					<summary>{{ label('snapshot') }}</summary>
					<pre class="overflow-auto">{{ JSON.stringify(selected.snapshot, null, 2) }}</pre>
				</details>
			</template>
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
	</el-card>
</template>
<script setup lang="ts">
import { computed, toRef } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElCheckbox, ElFormItem, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import { useBackend } from '../../../common';
import { useThermostatMemberContext } from '../composables/use-thermostat-member-context';
import type { ThermostatMemberDraft } from '../services/thermostat-authoring';
import { type ThermostatMemberContext, type ThermostatMemberRuntime, memberObservation, memberReading } from '../services/thermostat-members';

import ThermostatMemberInstallation from './thermostat-member-installation.vue';
import ThermostatMemberRecovery from './thermostat-member-recovery.vue';
import ThermostatPropertyPicker from './thermostat-property-picker.vue';

const props = defineProps<{
	member: ThermostatMemberDraft;
	parallel: boolean;
	controller?: string;
	configurationRevision: number;
	requestedLimit: number | null;
	disabled: boolean;
	setupDisabled?: boolean;
	runtime: ThermostatMemberRuntime | null;
	receivedAt: number;
	now: number;
}>();
const emit = defineEmits<{ remove: []; changed: [] }>();
const { t } = useI18n();
const label = (key: string) => t(`devicesVirtualPlugin.members.${key}`);
const backend = useBackend();
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
const selected = computed(() => context.value.value?.candidates.find((entry) => entry.property === props.member.protection?.source_property));
const observation = computed(() => memberObservation(props.runtime, props.receivedAt, props.now));
const reading = computed(() => memberReading(props.runtime, props.receivedAt, props.now));
const member = toRef(props, 'member');
const adopt = (enabled: string | number | boolean) => {
	if (enabled === true && !member.value.protection)
		member.value.protection = { schema_version: 1, kind: 'local_floor', source_property: null, maximum_age_seconds: null } as unknown as NonNullable<
			ThermostatMemberDraft['protection']
		>;
};
const selectSource = (value: string) => {
	if (member.value.protection && context.value.value?.candidates.some((entry) => entry.property === value))
		member.value.protection.source_property = value;
};
</script>
