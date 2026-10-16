<template>
	<section
		v-if="authorized"
		data-test-id="cover-ordering-recovery"
	>
		<el-alert
			:title="t('devicesShellyNgPlugin.coverRecovery.warning')"
			type="warning"
			:closable="false"
		/>
		<el-alert
			v-if="error"
			:title="error"
			type="error"
			:closable="false"
			data-test-id="recovery-error"
		/>
		<el-alert
			v-if="completed"
			:title="t('devicesShellyNgPlugin.coverRecovery.advisory')"
			type="warning"
			:closable="false"
			data-test-id="recovery-advisory"
		/>
		<el-button
			:loading="busy"
			:disabled="busy || !connected"
			data-test-id="recovery-context"
			@click="load"
		>
			{{ t('devicesShellyNgPlugin.coverRecovery.load') }}
		</el-button>
		<template v-if="context">
			<p>{{ context.physical_identity }} · {{ context.expected_revision }}</p>
			<p>{{ t('devicesShellyNgPlugin.coverRecovery.reservation', { token: context.expected_token, started: context.started_at }) }}</p>
			<el-checkbox
				v-model="acknowledged"
				:disabled="busy"
				data-test-id="recovery-ack"
			>
				{{ t('devicesShellyNgPlugin.coverRecovery.acknowledgement') }}
			</el-checkbox>
			<el-input
				v-model="reason"
				type="textarea"
				:maxlength="500"
				:disabled="busy"
				:placeholder="t('devicesShellyNgPlugin.coverRecovery.reason')"
				data-test-id="recovery-reason"
			/>
			<el-button
				type="warning"
				:loading="busy"
				:disabled="!ready"
				data-test-id="recovery-submit"
				@click="recover"
			>
				{{ t('devicesShellyNgPlugin.coverRecovery.accept') }}
			</el-button>
		</template>
	</section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCheckbox, ElInput } from 'element-plus';

import { useBackend } from '../../../common';
import { useSession } from '../../../modules/auth/composables/useSession';
import type { components } from '../../../openapi';

type Context = components['schemas']['DevicesShellyNgPluginDataCoverRecoveryContext'];
type Request = components['schemas']['DevicesShellyNgPluginRecoverCoverOrdering'];
const props = withDefaults(defineProps<{ deviceId: string; channelId: string; propertyId: string; connected?: boolean }>(), { connected: true });
const emit = defineEmits<{ recovered: [] }>();
const { t } = useI18n();
const backend = useBackend();
const { profile } = useSession();
const authorized = computed(() => ['owner', 'admin'].includes(profile.value?.role ?? ''));
const context = ref<Context | null>(null);
const acknowledged = ref(false),
	reason = ref(''),
	busy = ref(false),
	error = ref<string | null>(null),
	completed = ref(false);
const now = ref(Date.now());
let generation = 0;
let targetGeneration = 0;
const submitting = ref(false);
const clock = setInterval(() => {
	now.value = Date.now();
}, 1000);
/** Discard expired context without losing a submitted target's outcome on reconnect. */
const invalidate = (resetOutcome = true) => {
	generation++;
	context.value = null;
	acknowledged.value = false;
	reason.value = '';
	busy.value = submitting.value;
	if (resetOutcome) {
		completed.value = false;
		error.value = null;
	}
};
watch(
	() => [props.deviceId, props.channelId, props.propertyId, profile.value?.id, authorized.value],
	() => {
		targetGeneration++;
		submitting.value = false;
		invalidate();
	}
);
watch(
	() => props.connected,
	() => invalidate(false)
);
onBeforeUnmount(() => {
	targetGeneration++;
	invalidate();
	clearInterval(clock);
});
const ready = computed(
	() =>
		authorized.value &&
		props.connected &&
		!busy.value &&
		context.value !== null &&
		new Date(context.value.expires_at).getTime() > now.value &&
		acknowledged.value &&
		reason.value.trim().length > 0 &&
		reason.value.length <= 500
);
const path = () => ({ deviceId: props.deviceId, channelId: props.channelId, propertyId: props.propertyId });
const message = (cause: unknown): string => {
	if (cause && typeof cause === 'object') {
		if ('error' in cause && cause.error && typeof cause.error === 'object' && 'message' in cause.error) return String(cause.error.message);
		if ('message' in cause) return String(cause.message);
	}
	return t('devicesShellyNgPlugin.coverRecovery.unavailable');
};
const load = async () => {
	if (!authorized.value || !props.connected || busy.value) return;
	invalidate();
	const current = generation;
	busy.value = true;
	try {
		const result = await backend.client.GET(
			'/plugins/devices-shelly-ng/devices/{deviceId}/channels/{channelId}/properties/{propertyId}/cover-ordering-recovery',
			{ params: { path: path() } }
		);
		if (current !== generation) return;
		if (!result.data) throw result.error;
		context.value = result.data.data;
	} catch (cause) {
		if (current === generation) error.value = message(cause);
	} finally {
		if (current === generation) busy.value = false;
	}
};
const recover = async () => {
	if (!ready.value || !context.value) return;
	const selected = context.value,
		current = targetGeneration;
	submitting.value = true;
	busy.value = true;
	error.value = null;
	try {
		const result = await backend.client.POST(
			'/plugins/devices-shelly-ng/devices/{deviceId}/channels/{channelId}/properties/{propertyId}/cover-ordering-recovery',
			{
				params: { path: path() },
				body: {
					data: {
						context_id: selected.context_id,
						expected_token: selected.expected_token,
						expected_revision: selected.expected_revision,
						acknowledgement: 'accept_uncertain_physical_handback' as Request['acknowledgement'],
						reason: reason.value.trim(),
					},
				},
			}
		);
		if (current !== targetGeneration) return;
		if (!result.data) throw result.error;
		completed.value = true;
		emit('recovered');
	} catch (cause) {
		if (current === targetGeneration) error.value = message(cause);
	} finally {
		if (current === targetGeneration) {
			context.value = null;
			acknowledged.value = false;
			reason.value = '';
			submitting.value = false;
			busy.value = false;
		}
	}
};
</script>
