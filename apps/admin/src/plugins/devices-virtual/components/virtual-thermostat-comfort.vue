<template>
	<el-card
		data-test-id="thermostat-comfort"
		class="mt-4"
		@focusin="focused = true"
		@focusout="focused = false"
	>
		<template #header>{{ label('title') }}</template>
		<p>{{ label('help') }}</p>
		<el-alert
			v-if="state.error.value"
			:title="`${label('error')}: ${state.error.value}`"
			type="error"
			:closable="false"
		/>
		<el-button
			:disabled="state.pending.value"
			@click="reload"
		>
			{{ label('reload') }}
		</el-button>
		<template v-if="snapshot">
			<p>{{ label('requested') }}: {{ snapshot.configuration.requested_mode }}</p>
			<p>
				{{ label('activity') }}:
				{{ snapshot.runtime.branches.map((branch) => `${branch.role}: ${branch.activity}${branch.fault ? ` (${branch.fault})` : ''}`).join(' · ') }}
			</p>
			<p
				v-for="reason in snapshot.runtime.reasons"
				:key="reason"
			>
				{{ reason }}
			</p>
			<p>
				{{ label('effective') }}: {{ snapshot.comfort.effective.source }} / {{ snapshot.comfort.effective.preset ?? label('manual') }} ·
				{{ snapshot.comfort.effective.heating_setpoint ?? '—' }} / {{ snapshot.comfort.effective.cooling_setpoint ?? '—' }} °C
			</p>
			<p>{{ label('clockPolicy') }}: {{ snapshot.comfort.clock_policy }}</p>
			<p v-if="!configuration">{{ label('unconfigured') }}</p>
			<el-alert
				v-if="uncertain"
				:title="label('uncertain')"
				type="warning"
				:closable="false"
			/>
			<el-alert
				v-if="configuration?.user_off === true"
				:title="label('offHeld')"
				type="warning"
				:closable="false"
			/>
			<template v-if="override">
				<dl data-test-id="override-audit">
					<dt>{{ label('status') }}</dt>
					<dd>{{ override.status }}</dd>
					<dt>{{ label('source') }} / {{ label('actor') }}</dt>
					<dd>{{ override.source }} / {{ override.actor_id }}</dd>
					<dt>{{ label('identity') }} / {{ label('revision') }}</dt>
					<dd>{{ override.id }} / {{ override.revision }}</dd>
					<dt>{{ label('expires') }}</dt>
					<dd>{{ override.expires_at }}</dd>
				</dl>
				<p v-if="override.status === 'active'">{{ label('remaining') }}: {{ remaining ?? '—' }} s. {{ label('expiryHint') }}</p>
				<el-button
					v-for="active in cancellableOverrides"
					:key="active.id"
					data-test-id="cancel-override"
					:disabled="!canUse"
					@click="cancel(active.id, active.revision)"
				>
					{{ label('cancel') }}
				</el-button>
			</template>
			<el-divider>{{ label('configure') }}</el-divider>
			<p>{{ label('configHint') }}</p>
			<el-form
				:disabled="disabled || state.pending.value"
				label-position="top"
				@submit.prevent
			>
				<div
					v-for="branch in branches"
					:key="branch"
				>
					<p>{{ label(branch) }} (°C)</p>
					<el-form-item :label="label('minimum')">
						<el-input-number
							v-model="ranges[branch].minimum"
							:aria-label="`${label(branch)} ${label('minimum')}`"
							@change="edited"
						/>
					</el-form-item>
					<el-form-item :label="label('maximum')">
						<el-input-number
							v-model="ranges[branch].maximum"
							:aria-label="`${label(branch)} ${label('maximum')}`"
							@change="edited"
						/>
					</el-form-item>
				</div>
				<div
					v-for="preset in presets"
					:key="preset.preset"
				>
					<el-checkbox
						v-model="preset.enabled"
						@change="edited"
					>
						{{ label(preset.preset) }}
					</el-checkbox>
					<el-form-item
						v-for="branch in preset.enabled ? branches : []"
						:key="branch"
						:label="`${label(preset.preset)} · ${label(branch)} (°C)`"
					>
						<el-input-number
							v-model="preset.setpoints[`${branch}_setpoint`]"
							:aria-label="`${label(preset.preset)} ${label(branch)}`"
							@change="edited"
						/>
					</el-form-item>
				</div>
				<el-checkbox
					v-model="automation"
					@change="edited"
				>
					{{ label('automation') }}
				</el-checkbox>
				<p>{{ label('serverValidation') }}</p>
				<el-button
					data-test-id="save-comfort"
					:disabled="!canUse || !complete"
					@click="save"
				>
					{{ label('save') }}
				</el-button>
			</el-form>
			<template v-if="configuration">
				<el-divider>{{ label('selected') }}</el-divider>
				<el-select
					v-model="selection"
					:disabled="!canUse"
					:aria-label="label('selected')"
					@change="selectionEdited"
					@visible-change="menuOpen = $event"
				>
					<el-option
						value="manual"
						:label="label('manual')"
					/>
					<el-option
						v-for="preset in configuration.presets"
						:key="preset.preset"
						:value="preset.preset"
						:label="label(preset.preset)"
					/>
				</el-select>
				<el-button
					:disabled="!canUse"
					@click="select(false)"
				>
					{{ label('choose') }}
				</el-button>
				<el-button
					v-if="configuration.user_off === true"
					data-test-id="clear-user-off"
					:disabled="!canUse"
					@click="clearOff"
				>
					{{ label('clearOff') }}
				</el-button>
				<p>{{ label('offClearHelp') }}</p>
				<el-divider>{{ label('override') }}</el-divider>
				<el-select
					v-model="overridePreset"
					:disabled="disabled || state.pending.value"
					:aria-label="label('override')"
					@change="overrideEdited"
					@visible-change="menuOpen = $event"
				>
					<el-option
						value="explicit"
						:label="label('explicit')"
					/>
					<el-option
						v-for="preset in configuration.presets"
						:key="preset.preset"
						:value="preset.preset"
						:label="label(preset.preset)"
					/>
				</el-select>
				<el-form
					:disabled="disabled || state.pending.value"
					label-position="top"
				>
					<el-form-item
						v-for="branch in overridePreset === 'explicit' ? branches : []"
						:key="branch"
						:label="`${label(branch)} (°C)`"
					>
						<el-input-number
							v-model="overrideSetpoints[`${branch}_setpoint`]"
							:aria-label="`${label('override')} ${label(branch)}`"
							@change="overrideEdited"
						/>
					</el-form-item>
					<el-form-item :label="label('duration')">
						<el-input-number
							v-model="minutes"
							:min="1"
							:max="10080"
							:aria-label="label('duration')"
							@change="overrideEdited"
						/>
					</el-form-item>
				</el-form>
				<el-button
					data-test-id="create-override"
					:disabled="!canUse || !overrideComplete"
					@click="createOverride"
				>
					{{ label('create') }}
				</el-button>
			</template>
		</template>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { ElAlert, ElButton, ElCard, ElCheckbox, ElDivider, ElForm, ElFormItem, ElInputNumber, ElOption, ElSelect } from 'element-plus';

import { injectSockets, useBackend } from '../../../common';
import { useThermostatComfort } from '../composables/use-thermostat-comfort';
import {
	type ComfortDefinition,
	type ComfortPreset,
	finiteTemperature,
	remainingOverrideSeconds,
	thermostatComfortTransport,
} from '../services/thermostat-comfort';

const props = defineProps<{ deviceId: string; disabled?: boolean; revision?: number }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useI18n();
const label = (key: string) => t(`devicesVirtualPlugin.comfort.${key}`);
const sockets = injectSockets();
const state = useThermostatComfort(toRef(props, 'deviceId'), thermostatComfortTransport(useBackend()));
const snapshot = state.snapshot;
const configuration = computed(() => snapshot.value?.comfort.configuration);
const override = computed(() => configuration.value?.temporary_override);
const cancellableOverrides = computed(() =>
	override.value && ['active', 'clock_uncertain'].includes(override.value.status)
		? [{ id: override.value.id, revision: snapshot.value!.comfort.revision }]
		: []
);
const uncertain = computed(() => override.value != null && !['active', 'expired', 'cancelled'].includes(override.value.status));
const knownStatus = computed(() => !override.value || ['active', 'clock_uncertain', 'expired', 'cancelled'].includes(override.value.status));
const canUse = computed(() => state.canAct.value && !props.disabled && knownStatus.value && snapshot.value?.configuration.locked === false);
const branches = computed(() =>
	(['heating', 'cooling'] as const).filter((branch) => finiteTemperature(snapshot.value?.configuration.policy[`${branch}Setpoint`]))
);
const ranges = reactive({
	heating: { minimum: null as number | null, maximum: null as number | null },
	cooling: { minimum: null as number | null, maximum: null as number | null },
});
const presets = reactive(
	(['comfort', 'eco', 'away'] as const).map((preset) => ({
		preset,
		enabled: false,
		setpoints: { heating_setpoint: null as number | null, cooling_setpoint: null as number | null },
	}))
);
const automation = ref(false),
	dirty = ref(false),
	selectionDirty = ref(false),
	overrideDirty = ref(false),
	focused = ref(false),
	menuOpen = ref(false);
const selection = ref<string>('manual'),
	overridePreset = ref<string>('explicit');
const overrideSetpoints = reactive({ heating_setpoint: null as number | null, cooling_setpoint: null as number | null });
const minutes = ref<number | null>(null),
	now = ref(Date.now());
const remaining = computed(() => remainingOverrideSeconds(override.value?.expires_at, now.value));
const complete = computed(
	() =>
		branches.value.length > 0 &&
		branches.value.every(
			(branch) =>
				finiteTemperature(ranges[branch].minimum) && finiteTemperature(ranges[branch].maximum) && ranges[branch].minimum! <= ranges[branch].maximum!
		) &&
		presets.every((preset) => !preset.enabled || branches.value.every((branch) => finiteTemperature(preset.setpoints[`${branch}_setpoint`])))
);
const overrideComplete = computed(
	() =>
		minutes.value != null &&
		Number.isInteger(minutes.value) &&
		minutes.value >= 1 &&
		minutes.value <= 10080 &&
		(overridePreset.value !== 'explicit'
			? configuration.value?.presets.some((preset) => preset.preset === overridePreset.value)
			: branches.value.every((branch) => finiteTemperature(overrideSetpoints[`${branch}_setpoint`])))
);
watch(snapshot, () => {
	if (!dirty.value) {
		for (const branch of ['heating', 'cooling'] as const)
			Object.assign(ranges[branch], configuration.value?.[`${branch}_range`] ?? { minimum: null, maximum: null });
		for (const preset of presets) {
			const saved = configuration.value?.presets.find((entry) => entry.preset === preset.preset);
			preset.enabled = saved !== undefined;
			Object.assign(preset.setpoints, saved?.setpoints ?? { heating_setpoint: null, cooling_setpoint: null });
		}
		automation.value = configuration.value?.automation_enabled === true;
	}
	if (!selectionDirty.value) selection.value = configuration.value?.selected_preset ?? 'manual';
});
watch(
	() => props.deviceId,
	() => {
		dirty.value = false;
		selectionDirty.value = false;
		overrideDirty.value = false;
		focused.value = false;
		menuOpen.value = false;
		overridePreset.value = 'explicit';
		overrideSetpoints.heating_setpoint = null;
		overrideSetpoints.cooling_setpoint = null;
		minutes.value = null;
	}
);
watch(
	() => [props.disabled, props.revision],
	() => {
		state.invalidate();
		void state.reload();
	}
);
const edited = () => {
	dirty.value = true;
	state.edit();
};
const selectionEdited = () => {
	selectionDirty.value = true;
	state.edit();
};
const overrideEdited = () => {
	overrideDirty.value = true;
	state.edit();
};
const reload = () => {
	dirty.value = false;
	selectionDirty.value = false;
	overrideDirty.value = false;
	void state.reload();
};
const changed = () => emit('changed');
const save = async () => {
	const input = {
		heating_range: branches.value.includes('heating') ? { ...ranges.heating } : null,
		cooling_range: branches.value.includes('cooling') ? { ...ranges.cooling } : null,
		presets: presets
			.filter((preset) => preset.enabled)
			.map((preset) => ({
				preset: preset.preset,
				setpoints: {
					heating_setpoint: branches.value.includes('heating') ? preset.setpoints.heating_setpoint : null,
					cooling_setpoint: branches.value.includes('cooling') ? preset.setpoints.cooling_setpoint : null,
				},
			})),
		automation_enabled: automation.value,
	};
	if (await state.act({ kind: 'configure', input: input as ComfortDefinition })) {
		dirty.value = false;
		changed();
	}
};
const select = async (clear: boolean) => {
	if (
		await state.act({ kind: 'selection', preset: selection.value === 'manual' ? null : (selection.value as ComfortPreset), clear_user_off: clear })
	) {
		selectionDirty.value = false;
		changed();
	}
};
const clearOff = async () => {
	if (await state.act({ kind: 'selection', preset: (configuration.value?.selected_preset as ComfortPreset | null) ?? null, clear_user_off: true }))
		changed();
};
const createOverride = async () => {
	if (!overrideComplete.value) return;
	if (
		await state.act({
			kind: 'override',
			preset: overridePreset.value === 'explicit' ? null : (overridePreset.value as ComfortPreset),
			setpoints:
				overridePreset.value === 'explicit'
					? {
							heating_setpoint: branches.value.includes('heating') ? overrideSetpoints.heating_setpoint : null,
							cooling_setpoint: branches.value.includes('cooling') ? overrideSetpoints.cooling_setpoint : null,
						}
					: null,
			expires_at: new Date(Date.now() + minutes.value! * 60_000).toISOString(),
		})
	) {
		overrideDirty.value = false;
		changed();
	}
};
const cancel = async (id: string, revision: number) => {
	if (override.value?.id !== id || snapshot.value?.comfort.revision !== revision) {
		state.invalidate();
		void state.reload();
		return;
	}
	if (await state.act({ kind: 'cancel', override_id: id })) changed();
};
const reconnect = () => {
	state.invalidate();
	void state.reload();
};
const disconnect = () => state.invalidate();
const hint = (event: { event: string; payload: unknown }) => {
	if (
		event.event === 'DevicesVirtualPlugin.Thermostat.RuntimeChanged' &&
		event.payload &&
		typeof event.payload === 'object' &&
		'controller' in event.payload &&
		event.payload.controller === props.deviceId &&
		'configuration_revision' in event.payload &&
		typeof event.payload.configuration_revision === 'number'
	)
		state.serverRevision(event.payload.configuration_revision);
};
let timer: ReturnType<typeof setInterval> | undefined,
	expiredId: string | null = null,
	ticks = 0;
onMounted(() => {
	void state.reload();
	sockets.on('event', hint);
	sockets.on('connect', reconnect);
	sockets.on('disconnect', disconnect);
	timer = setInterval(() => {
		now.value = Date.now();
		const pollDue = ++ticks % 5 === 0;
		if (override.value?.status === 'active' && remaining.value === 0 && expiredId !== override.value.id) {
			expiredId = override.value.id;
			reconnect();
		} else if (pollDue && !dirty.value && !selectionDirty.value && !overrideDirty.value && !focused.value && !menuOpen.value) void state.reload();
	}, 1000);
});
onBeforeUnmount(() => {
	state.dispose();
	clearInterval(timer);
	sockets.off('event', hint);
	sockets.off('connect', reconnect);
	sockets.off('disconnect', disconnect);
});
</script>
