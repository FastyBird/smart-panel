<template>
	<details data-test-id="member-recovery">
		<summary>{{ label('recovery') }}</summary>
		<p>{{ label('recoveryHelp') }}</p>
		<p>{{ claim.id }} · {{ claim.physical_identity }} · r{{ claim.revision }} · {{ claim.qualification_generation ?? '—' }}</p>
		<thermostat-property-picker
			v-model="replacement"
			kind="actuator"
		/>
		<el-input
			v-model="reason"
			:placeholder="label('reason')"
			:disabled="disabled || pending"
		/>
		<el-checkbox
			v-model="acknowledged"
			:disabled="disabled || pending"
		>
			{{ label('disconnection') }}
		</el-checkbox>
		<el-alert
			v-if="error"
			:title="error"
			type="error"
			:closable="false"
		/>
		<el-button
			v-if="error"
			:disabled="pending"
			@click="emit('changed')"
		>
			{{ label('reload') }}
		</el-button>
		<el-button
			:disabled="disabled || pending || !replacement || !reason.trim() || !acknowledged || !controller"
			@click="recover"
		>
			{{ label('recover') }}
		</el-button>
	</details>
</template>
<script setup lang="ts">
import { onScopeDispose, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElInput } from 'element-plus';

import { useBackend } from '../../../common';
import type { ThermostatClaim } from '../services/thermostat-authoring';

import ThermostatPropertyPicker from './thermostat-property-picker.vue';

const props = defineProps<{ claim: ThermostatClaim; controller?: string; configurationRevision: number; disabled: boolean }>();
const emit = defineEmits<{ changed: [] }>();
const backend = useBackend(),
	replacement = ref<string | null>(null),
	reason = ref(''),
	acknowledged = ref(false),
	pending = ref(false),
	error = ref<string | null>(null);
const { t } = useI18n();
const label = (key: string) => t(`devicesVirtualPlugin.members.${key}`);
let alive = true;
onScopeDispose(() => {
	alive = false;
});
const recover = async () => {
	if (!replacement.value || !reason.value.trim() || !acknowledged.value || !props.controller || props.disabled || pending.value) return;
	const id = props.controller,
		claimId = props.claim.id,
		revision = props.configurationRevision;
	pending.value = true;
	error.value = null;
	try {
		const { data, error: failure } = await backend.client.POST('/plugins/devices-virtual/producers/thermostats/{id}/claims/{claimId}/restore', {
			params: { path: { id, claimId } },
			body: {
				expected_revision: revision,
				expected_claim_revision: props.claim.revision,
				physical_identity: props.claim.physical_identity,
				source_property: replacement.value,
				reason: reason.value.trim(),
				disconnection_acknowledged: true,
			},
		});
		if (!alive || id !== props.controller || claimId !== props.claim.id || revision !== props.configurationRevision || props.disabled) return;
		if (!data) throw new Error(JSON.stringify(failure));
		emit('changed');
	} catch (cause) {
		if (alive && id === props.controller && claimId === props.claim.id && revision === props.configurationRevision) error.value = String(cause);
	} finally {
		if (alive) pending.value = false;
	}
};
</script>
