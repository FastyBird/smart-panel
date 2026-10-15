<template>
	<details data-test-id="member-installation">
		<summary>{{ label('installation') }}</summary>
		<p>{{ label('stagingOnly') }}</p>
		<el-alert
			v-if="state.error.value || error"
			:title="state.error.value ?? error ?? ''"
			type="error"
			:closable="false"
		/>
		<p v-if="state.value.value?.profile">{{ state.value.value.profile.readiness }} · r{{ state.value.value.profile.revision }}</p>
		<el-alert
			v-for="reason in [...(state.value.value?.context.reasons ?? []), ...(state.value.value?.profile?.reasons ?? [])]"
			:key="reason"
			:title="reason"
			type="warning"
			:closable="false"
		/>
		<details v-if="state.value.value?.profile">
			<summary>{{ label('retainedProfile') }}</summary>
			<pre>{{ JSON.stringify(state.value.value.profile, null, 2) }}</pre>
		</details>
		<template v-if="claim.protection">
			<el-form
				label-position="top"
				:disabled="disabled || pending"
			>
				<el-form-item
					v-for="field in textFields"
					:key="field.key"
					:label="label(field.label)"
				>
					<el-input v-model="draft[field.key]" />
				</el-form-item>
				<el-form-item
					v-for="field in numericFields"
					:key="field.key"
					:label="label(field.label)"
				>
					<el-input-number
						v-model="draft[field.key]"
						:controls="false"
					/>
				</el-form-item>
				<p>{{ label('cutoff') }}: {{ requestedLimit !== null && draft.ceiling !== null ? Math.min(requestedLimit, draft.ceiling) : '—' }} °C</p>
				<p>{{ label('evidenceHelp') }}</p>
				<div
					v-for="(evidence, index) in draft.attestations"
					:key="index"
					class="border p-2 mb-2"
				>
					<el-select v-model="evidence.kind">
						<el-option
							v-for="kind in attestationKinds"
							:key="kind"
							:value="kind"
							:label="kind"
						/>
					</el-select>
					<el-input
						v-model="evidence.equipment"
						:placeholder="label('equipment')"
					/>
					<el-input
						v-model="evidence.procedure"
						:placeholder="label('procedure')"
					/>
					<el-input
						v-model="evidence.evidenceReference"
						:placeholder="label('evidence')"
					/>
					<el-input
						v-model="evidence.testedAt"
						:placeholder="label('testedAt')"
					/>
					<el-input-number
						v-model="evidence.maximumObservedMs"
						:controls="false"
						:placeholder="label('observedMs')"
					/>
					<el-button @click="draft.attestations.splice(index, 1)">{{ label('removeDraft') }}</el-button>
				</div>
				<el-button
					:disabled="draft.attestations.length >= 7"
					@click="draft.attestations.push({ kind: '', equipment: '', procedure: '', evidenceReference: '', testedAt: '', maximumObservedMs: null })"
				>
					{{ label('addEvidence') }}
				</el-button>
				<details>
					<summary>{{ label('snapshot') }}</summary>
					<pre>{{ JSON.stringify(state.value.value?.context, null, 2) }}</pre>
				</details>
				<el-button
					:disabled="!request || !current || disabled || pending"
					@click="stage"
				>
					{{ label('stage') }}
				</el-button>
			</el-form>
		</template>
		<p v-else>{{ label('legacyProfile') }}</p>
		<el-button
			:disabled="pending"
			@click="state.reload"
		>
			{{ label('reload') }}
		</el-button>
	</details>
</template>
<script setup lang="ts">
import { computed, onScopeDispose, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import { useBackend } from '../../../common';
import { useThermostatMemberContext } from '../composables/use-thermostat-member-context';
import type { ThermostatClaim } from '../services/thermostat-authoring';
import { attestationKinds, emptyMemberInstallation, memberInstallationRequest } from '../services/thermostat-member-installation';
import type { ThermostatInstallation, ThermostatMemberContext } from '../services/thermostat-members';

const props = defineProps<{ claim: ThermostatClaim; configurationRevision: number; requestedLimit: number | null; disabled: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const label = (key: string) => t(`devicesVirtualPlugin.members.${key}`);
let alive = true;
onScopeDispose(() => {
	alive = false;
});
const backend = useBackend(),
	pending = ref(false),
	error = ref<string | null>(null),
	draft = ref(emptyMemberInstallation());
const key = computed(() => `${props.claim.id}:${props.claim.revision}:${props.configurationRevision}:${props.claim.qualification_generation ?? ''}`);
const state = useThermostatMemberContext<{ context: ThermostatMemberContext; profile: ThermostatInstallation | null }>(key, async (_, signal) => {
	const claim = props.claim.id;
	const [context, profile] = await Promise.all([
		backend.client.GET('/plugins/devices-virtual/producers/thermostat-member-authoring/claims/{claim}', { params: { path: { claim } }, signal }),
		backend.client.GET('/plugins/devices-virtual/producers/thermostat-installations/{claim}', { params: { path: { claim } }, signal }),
	]);
	if (!context.data || (!profile.data && profile.response.status !== 404)) throw new Error(JSON.stringify(context.error ?? profile.error));
	return { context: context.data.data, profile: profile.data?.data ?? null };
});
const current = computed(
	() =>
		state.value.value?.context.configuration_revision === props.configurationRevision &&
		state.value.value.context.claim_revision === props.claim.revision
);
const request = computed(() =>
	memberInstallationRequest(
		draft.value,
		state.value.value?.context ?? null,
		state.value.value?.profile?.revision ?? 0,
		props.claim.qualification_generation
	)
);
const textFields = [
	{ key: 'endpoint', label: 'endpoint' },
	{ key: 'epoch', label: 'epoch' },
] as const;
const numericFields = [
	{ key: 'script', label: 'script' },
	{ key: 'ceiling', label: 'ceiling' },
	{ key: 'minimumLease', label: 'minimumLease' },
	{ key: 'maximumLease', label: 'maximumLease' },
	{ key: 'watchdog', label: 'watchdog' },
	{ key: 'heatingMinimum', label: 'heatingMinimum' },
	{ key: 'heatingMaximum', label: 'heatingMaximum' },
	{ key: 'coolingMinimum', label: 'coolingMinimum' },
	{ key: 'coolingMaximum', label: 'coolingMaximum' },
] as const;
const stage = async () => {
	if (!request.value || !current.value || pending.value || props.disabled) return;
	const body = structuredClone(request.value),
		identity = key.value,
		claim = props.claim.id;
	pending.value = true;
	error.value = null;
	try {
		const { data, error: failure } = await backend.client.PUT('/plugins/devices-virtual/producers/thermostat-installations/{claim}', {
			params: { path: { claim } },
			body,
		});
		if (!alive || identity !== key.value || props.disabled) return;
		if (!data) throw new Error(JSON.stringify(failure));
		emit('changed');
		await state.reload();
	} catch (cause) {
		if (alive && identity === key.value) {
			error.value = String(cause);
			state.invalidate();
			void state.reload();
		}
	} finally {
		if (alive) pending.value = false;
	}
};
</script>
