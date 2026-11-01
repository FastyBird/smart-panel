<template>
	<el-card
		class="mt-3"
		data-test-id="native-thermostat-editor"
	>
		<template #header>{{ label('title') }}</template>
		<el-alert
			:title="label('delegation')"
			type="info"
			:closable="false"
		/>
		<el-alert
			v-if="error"
			:title="error"
			type="error"
			:closable="false"
			class="mt-2"
		/>
		<el-button
			:disabled="busy"
			class="mt-3"
			data-test-id="native-refresh"
			@click="reload()"
		>
			{{ label('refresh') }}
		</el-button>
		<el-form
			v-if="create && canAuthor"
			label-position="top"
			class="mt-3"
			@submit.prevent="createUnit"
		>
			<el-form-item :label="label('name')">
				<el-input
					v-model="name"
					:disabled="busy"
				/>
			</el-form-item>
			<el-form-item :label="label('unit')">
				<el-select
					v-model="source"
					:disabled="busy"
					class="w-full"
				>
					<el-option
						v-for="candidate in candidates"
						:key="candidate.device"
						:value="candidate.device"
						:disabled="candidate.reasons.length > 0"
						:label="`${candidate.name} · ${candidate.provider}`"
					/>
				</el-select>
			</el-form-item>
			<p v-if="!candidates.length">{{ label('noCandidates') }}</p>
			<el-button
				:disabled="busy || !name.trim() || !selected"
				data-test-id="native-create"
				@click="createUnit"
			>
				{{ label('create') }}
			</el-button>
		</el-form>
		<template v-if="snapshot">
			<p>{{ label('binding') }}: {{ label(snapshot.binding_state) }}</p>
			<el-alert
				v-if="snapshot.drift.length"
				:title="label('drift')"
				:description="snapshot.drift.join(', ')"
				type="warning"
				:closable="false"
			/>
			<p class="mt-3">{{ snapshot.provider }} · {{ snapshot.physical_identity }}</p>
			<p>
				{{ label('requested') }}: {{ snapshot.requested.mode ?? '—' }} · {{ snapshot.requested.heatingSetpoint ?? '—' }} /
				{{ snapshot.requested.coolingSetpoint ?? '—' }} °C
			</p>
			<p data-test-id="native-observed">
				{{ label('observed') }}: {{ ready && snapshot.observed.available ? (snapshot.observed.mode ?? '—') : label('unavailable') }} ·
				{{ ready ? (snapshot.observed.temperature ?? '—') : '—' }} °C ·
				{{ ready ? (snapshot.observed.activity ?? label('unavailable')) : label('unavailable') }}
			</p>
			<p
				v-for="reason in snapshot.observed.reasons"
				:key="reason"
			>
				{{ reason }}
			</p>
			<p v-if="snapshot.observed.observedAt">{{ label('sampled') }}: {{ snapshot.observed.observedAt }}</p>
			<el-alert
				:title="label('acceptance')"
				type="info"
				:closable="false"
			/>
			<template v-if="canAuthor && snapshot.capabilities && snapshot.binding_state === 'bound'">
				<el-divider>{{ label('request') }}</el-divider>
				<el-select
					v-model="mode"
					:disabled="busy || !ready"
					:aria-label="label('mode')"
				>
					<el-option
						v-for="value in snapshot.capabilities.modes"
						:key="value"
						:value="value"
						:label="value"
					/>
				</el-select>
				<el-button
					:disabled="busy || !ready || !modeAction"
					data-test-id="native-mode"
					@click="modeAction && act(modeAction)"
				>
					{{ label('sendMode') }}
				</el-button>
				<div
					v-for="branch in branches"
					:key="branch"
					class="mt-3"
				>
					<template v-if="snapshot.capabilities[branch]">
						<el-input-number
							v-model="targets[branch]"
							:disabled="busy || !ready"
							:min="snapshot.capabilities[branch]!.minimum"
							:max="snapshot.capabilities[branch]!.maximum"
							:step="snapshot.capabilities[branch]!.step"
							:aria-label="label(branch)"
						/>
						<el-button
							:disabled="busy || !ready || !nativeTargetAction(snapshot, branch, targets)"
							:data-test-id="`native-${branch}`"
							@click="setpoint(branch)"
						>
							{{ label(branch) }} °C
						</el-button>
					</template>
				</div>
				<p v-if="!snapshot.capabilities.supportsCompound">{{ label('singleOperation') }}</p>
			</template>
			<el-button
				v-if="canAuthor && snapshot.binding_state === 'bound'"
				:disabled="busy || !ready"
				class="mt-3"
				data-test-id="native-revalidate"
				@click="revalidate"
			>
				{{ label('revalidate') }}
			</el-button>
			<el-button
				v-if="canAuthor && snapshot.binding_state !== 'released'"
				:disabled="busy || !ready"
				class="mt-3"
				data-test-id="native-release"
				@click="release"
			>
				{{ label('release') }}
			</el-button>
			<div
				v-if="snapshot.latest_request"
				class="mt-3"
				data-test-id="native-outcome"
			>
				<p>{{ label('outcome') }}: {{ snapshot.latest_request.state }}</p>
				<p
					v-for="(operation, index) in snapshot.latest_request.operations"
					:key="index"
				>
					{{ operation.operation }}: {{ label(operation.outcome) }} {{ operation.reason ?? '' }}
				</p>
			</div>
		</template>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

import { ElAlert, ElButton, ElCard, ElDivider, ElForm, ElFormItem, ElInput, ElInputNumber, ElMessageBox, ElOption, ElSelect } from 'element-plus';
import { v4 as uuid } from 'uuid';

import { useBackend } from '../../../common';
import { useSession } from '../../../modules/auth/composables/useSession';
import {
	type NativeAction,
	type NativeCandidate,
	type NativeMode,
	type NativeSnapshot,
	nativeAutoAction,
	nativeTargetAction,
	nativeThermostatTransport,
} from '../services/native-thermostat';

const props = defineProps<{ create?: boolean; deviceId?: string }>();
const emit = defineEmits<{ created: [id: string]; absent: [] }>();
const { t } = useI18n();
const label = (key: string) => t(`devicesVirtualPlugin.nativeThermostat.${key}`);
const { profile } = useSession();
const canAuthor = computed(() => ['owner', 'admin'].includes(profile.value?.role ?? ''));
const transport = nativeThermostatTransport(useBackend());
const candidates = ref<NativeCandidate[]>([]);
const snapshot = ref<NativeSnapshot | null>(null);
const name = ref('');
const source = ref('');
const selected = computed(() => candidates.value.find((candidate) => candidate.device === source.value));
const mode = ref<NativeMode>();
const branches = ['heating', 'cooling'] as const;
const targets = ref<{ heating: number | undefined; cooling: number | undefined }>({ heating: undefined, cooling: undefined });
const modeAction = computed<NativeAction | null>(() => {
	if (!mode.value || !snapshot.value?.capabilities) return null;
	if (mode.value !== 'auto') return { mode: mode.value };
	return nativeAutoAction(snapshot.value.capabilities, targets.value);
});
const busy = ref(false);
const ready = ref(false);
const error = ref<string | null>(null);
let generation = 0;
let alive = true;
let reader: AbortController | undefined;
let pending: Promise<void> | undefined;
/** Total deadline includes transport and parsing; abort alone would not settle a stalled client. */
const bounded = async <T,>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> => {
	const controller = new AbortController();
	reader = controller;
	let timer: ReturnType<typeof setTimeout>;
	try {
		return await Promise.race([
			operation(controller.signal),
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => {
					controller.abort();
					reject(new Error('deadline'));
				}, 10_000);
			}),
		]);
	} finally {
		clearTimeout(timer!);
	}
};
const reload = async (preserveDraft = false) => {
	if (busy.value) return;
	const ticket = ++generation;
	const id = props.deviceId;
	busy.value = true;
	ready.value = false;
	error.value = null;
	try {
		if (props.create) {
			const result = await bounded((signal) => transport.candidates(signal));
			if (alive && ticket === generation) candidates.value = result;
		} else if (id) {
			const result = await bounded((signal) => transport.read(id, signal));
			if (!alive || ticket !== generation || id !== props.deviceId) return;
			if (!result) {
				emit('absent');
				return;
			}
			if (result.controller !== id) throw new Error('controller_conflict');
			snapshot.value = result;
			if (!preserveDraft) {
				mode.value = result.requested.mode;
				targets.value = { heating: result.requested.heatingSetpoint, cooling: result.requested.coolingSetpoint };
			}
			ready.value = true;
		}
	} catch {
		if (alive && ticket === generation) error.value = label('readFailed');
	} finally {
		if (alive && ticket === generation) busy.value = false;
	}
};
const mutate = async (operation: (signal: AbortSignal) => Promise<NativeSnapshot>, creating = false) => {
	if (busy.value || !canAuthor.value) return;
	const ticket = ++generation;
	busy.value = true;
	ready.value = false;
	error.value = null;
	pending = (async () => {
		try {
			const result = await bounded(operation);
			if (!alive || ticket !== generation) return;
			if (creating) {
				name.value = '';
				emit('created', result.controller);
				return;
			}
			if (result.controller !== props.deviceId) throw new Error('controller_conflict');
			snapshot.value = result;
			ready.value = true;
		} catch {
			if (alive && ticket === generation) error.value = label('uncertain');
		} finally {
			if (alive && ticket === generation) busy.value = false;
		}
	})();
	await pending;
};
const createUnit = () => {
	if (!name.value.trim() || !selected.value || selected.value.reasons.length) return;
	const input = { name: name.value.trim(), source: selected.value.device };
	return mutate((signal) => transport.create(input.name, input.source, signal), true);
};
const act = (action: NativeAction) => {
	if (!snapshot.value || !ready.value) return;
	const state = snapshot.value;
	const requestId = uuid();
	return mutate((signal) => transport.request(state.controller, state.revision, requestId, action, signal));
};
const setpoint = (branch: 'heating' | 'cooling') => {
	if (!snapshot.value) return;
	const action = nativeTargetAction(snapshot.value, branch, targets.value);
	if (action) return act(action);
};
const revalidate = () => {
	if (!snapshot.value || !ready.value) return;
	const state = snapshot.value;
	return mutate((signal) => transport.revalidate(state.controller, state.revision, state.source_device, signal));
};
const release = async () => {
	if (!snapshot.value || !ready.value || busy.value || !canAuthor.value) return;
	const state = snapshot.value;
	try {
		await ElMessageBox.confirm(label('releaseHelp'));
	} catch {
		return;
	}
	if (!alive || !ready.value || state.controller !== props.deviceId || state.revision !== snapshot.value?.revision) return;
	return mutate((signal) => transport.release(state.controller, state.revision, signal));
};
watch(
	() => [props.deviceId, props.create],
	() => {
		generation++;
		reader?.abort();
		busy.value = false;
		snapshot.value = null;
		void reload();
	},
	{ immediate: true }
);
const poll = setInterval(() => {
	if (!props.create && !busy.value) void reload(true);
}, 5_000);
onBeforeUnmount(() => {
	clearInterval(poll);
	alive = false;
	generation++;
	reader?.abort();
});
const confirmLeave = async () => {
	await pending;
	if (!props.create || !name.value.trim()) return true;
	try {
		await ElMessageBox.confirm(label('discard'));
		return true;
	} catch {
		return false;
	}
};
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);
defineExpose({ hasUnsavedChanges: computed(() => !!name.value.trim()), waitForSave: () => pending ?? Promise.resolve() });
</script>
