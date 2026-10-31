<template>
	<el-card
		v-loading="loading || supplementalLoading"
		shadow="never"
		class="m-2"
	>
		<template #header>
			<h3 class="m-0">{{ text('title') }}</h3>
		</template>
		<p>{{ text('description') }}</p>
		<p data-testid="occupancy-observed">
			{{ text('status') }}: {{ text(props.supported !== false && state?.running ? (state.status ?? 'unknown') : 'unknown') }}
		</p>
		<p v-if="state?.manual_override">{{ text('manual') }}</p>
		<el-button
			v-if="state?.manual_override && canEdit"
			:disabled="busy || loading || submitting || dirty || !configuration"
			:loading="submitting"
			data-testid="occupancy-resume"
			@click="resume"
		>
			{{ text('resume') }}
		</el-button>
		<el-alert
			v-if="error || supplementalError"
			:title="text(error ?? 'supplementalFailed')"
			type="warning"
			:closable="false"
		/>
		<el-button
			:disabled="busy || loading || submitting || supplementalLoading"
			data-testid="occupancy-refresh"
			@click="refresh"
		>
			{{ text('refresh') }}
		</el-button>
		<template v-if="draft">
			<p v-if="props.supported === false">{{ text('unsupportedSpace') }}</p>
			<p v-else-if="!canEdit">{{ text('readOnly') }}</p>
			<el-form
				label-position="top"
				:disabled="!canEdit || busy || loading || submitting"
			>
				<el-form-item :label="text('enabled')">
					<el-switch
						v-model="draft.enabled"
						data-testid="occupancy-enabled"
					/>
				</el-form-item>
				<el-form-item :label="text('timeout')">
					<el-input-number
						v-model="timeoutMinutes"
						:min="0.5"
						:max="1440"
						:step="0.5"
						data-testid="occupancy-timeout"
					/>
				</el-form-item>
				<el-form-item :label="text('maximumAge')">
					<el-input-number
						v-model="ageMinutes"
						:min="1"
						:max="1440"
						data-testid="occupancy-maximum-age"
					/>
				</el-form-item>
				<el-form-item :label="text('sensors')">
					<el-checkbox-group
						v-model="draft.sensor_property_ids"
						data-testid="occupancy-sensors"
					>
						<el-checkbox
							v-for="sensor in options"
							:key="sensor.property_id"
							:value="sensor.property_id"
						>
							{{ sensor.label }}
						</el-checkbox>
					</el-checkbox-group>
				</el-form-item>
				<el-form-item :label="text('whenOccupied')">
					<el-select
						:model-value="draft.occupied_mode ?? ''"
						data-testid="occupancy-occupied-mode"
						@update:model-value="
							(value: string) => {
								if (draft) draft.occupied_mode = value === '' ? null : (value as ActivityMode);
							}
						"
					>
						<el-option
							value=""
							:label="text('restore')"
						/>
						<el-option
							v-for="mode in modes"
							:key="mode"
							:value="mode"
							:label="modeText(mode)"
						/>
					</el-select>
				</el-form-item>
				<el-form-item :label="text('whenVacant')">
					<el-select
						:model-value="draft.vacant_mode ?? ''"
						data-testid="occupancy-vacant-mode"
						@update:model-value="
							(value: string) => {
								if (draft) draft.vacant_mode = value === '' ? null : (value as ActivityMode);
							}
						"
					>
						<el-option
							value=""
							:label="text('noChange')"
						/>
						<el-option
							v-for="mode in modes"
							:key="mode"
							:value="mode"
							:label="modeText(mode)"
						/>
					</el-select>
				</el-form-item>
			</el-form>
			<el-alert
				v-if="!valid"
				:title="text('invalid')"
				type="warning"
				:closable="false"
			/>
			<el-alert
				v-if="dirty && configuration?.revision !== revision"
				:title="text('conflictHelp')"
				type="warning"
				:closable="false"
			/>
			<el-button
				:disabled="!canSave"
				:loading="busy"
				data-testid="occupancy-save"
				@click="submit"
			>
				{{ text('save') }}
			</el-button>
			<el-button
				:disabled="busy || loading || submitting || !dirty || !configuration"
				data-testid="occupancy-discard"
				@click="discard"
			>
				{{ text('discard') }}
			</el-button>
			<p v-if="dirty">{{ text('unsaved') }}</p>
		</template>
	</el-card>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElCheckboxGroup,
	ElForm,
	ElFormItem,
	ElInputNumber,
	ElOption,
	ElSelect,
	ElSwitch,
	vLoading,
} from 'element-plus';
import { cloneDeep, isEqual } from 'lodash';

import { useBackend } from '../../../common';
import { useSession } from '../../../modules/auth/composables/useSession';
import type { components } from '../../../openapi';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { ActivityMode } from '../composables/useSpaceActivityModes';
import { type OccupancyDraft, occupancyDraft, useSpaceOccupancy } from '../composables/useSpaceOccupancy';

const props = withDefaults(defineProps<{ spaceId: string; supported?: boolean }>(), { supported: true });
const { t } = useI18n();
const text = (key: string) => t(`spacesHomeControlPlugin.occupancy.${key}`);
const modeText = (mode: string) => t(`spacesHomeControlPlugin.activityModes.modes.${mode}`);
const { profile } = useSession();
const canEdit = computed(
	() => props.supported !== false && [UsersModuleUserRole.owner, UsersModuleUserRole.admin].includes(profile.value?.role as UsersModuleUserRole)
);
const { client } = useBackend();
const { configuration, loading, busy, error, load, save } = useSpaceOccupancy(computed(() => props.spaceId));
const draft = ref<OccupancyDraft | null>(null);
const baseline = ref<OccupancyDraft | null>(null);
const revision = ref(0);
const dirty = computed(() => !isEqual(draft.value, baseline.value));
const state = ref<components['schemas']['SpacesHomeControlPluginDataOccupancyState'] | null>(null);
const sensors = ref<components['schemas']['SpacesHomeControlPluginDataOccupancySensor'][]>([]);
const supplementalLoading = ref(false);
const supplementalError = ref(false);
let controller: AbortController | null = null;
let generation = 0;
let submission: Promise<void> | null = null;
const submitting = ref(false);
let disposed = false;
let resumeController: AbortController | null = null;
const modes = Object.values(ActivityMode);
const options = computed(() => [
	...sensors.value,
	...(draft.value?.sensor_property_ids ?? [])
		.filter((id) => !sensors.value.some((sensor) => sensor.property_id === id))
		.map((id) => ({ property_id: id, device_id: '', label: `${text('missingSensor')} (${id})` })),
]);
const timeoutMinutes = computed({
	get: () => (draft.value?.vacancy_timeout_seconds ?? 900) / 60,
	set: (value: number | undefined) => {
		if (draft.value && value !== undefined) draft.value.vacancy_timeout_seconds = Math.round(value * 60);
	},
});
const ageMinutes = computed({
	get: () => (draft.value?.maximum_age_seconds ?? 3600) / 60,
	set: (value: number | undefined) => {
		if (draft.value && value !== undefined) draft.value.maximum_age_seconds = Math.round(value * 60);
	},
});
const valid = computed(
	() =>
		!!draft.value &&
		(!draft.value.enabled || draft.value.sensor_property_ids.length > 0) &&
		draft.value.sensor_property_ids.length <= 32 &&
		draft.value.maximum_age_seconds > draft.value.vacancy_timeout_seconds
);
const canSave = computed(
	() =>
		canEdit.value &&
		!submitting.value &&
		dirty.value &&
		valid.value &&
		!busy.value &&
		!loading.value &&
		configuration.value?.revision === revision.value &&
		!['conflict', 'loadFailed', 'saveUnconfirmed'].includes(error.value ?? '')
);
const reset = () => {
	if (configuration.value) {
		draft.value = occupancyDraft(configuration.value);
		baseline.value = cloneDeep(draft.value);
		revision.value = configuration.value.revision;
	}
};
watch(configuration, () => {
	if (!dirty.value) reset();
});
const supplemental = async () => {
	if (disposed) return;
	controller?.abort();
	const current = new AbortController();
	controller = current;
	const token = ++generation;
	const id = props.spaceId;
	supplementalLoading.value = true;
	supplementalError.value = false;
	const timeout = setTimeout(() => current.abort(), 10_000);
	try {
		const [available, observed] = await Promise.allSettled([
			client.GET('/modules/spaces/spaces/{id}/occupancy/sensors', { params: { path: { id } }, signal: current.signal }),
			client.GET('/modules/spaces/spaces/{id}/occupancy/state', { params: { path: { id } }, signal: current.signal }),
		]);
		if (token !== generation || id !== props.spaceId) return;
		const sensorData = available.status === 'fulfilled' ? available.value.data?.data : undefined;
		const stateData = observed.status === 'fulfilled' ? observed.value.data?.data : undefined;
		sensors.value = sensorData ?? [];
		state.value = stateData?.space_id === id ? stateData : null;
		supplementalError.value = !sensorData || !state.value;
	} catch {
		if (token === generation) {
			supplementalError.value = true;
			state.value = null;
		}
	} finally {
		clearTimeout(timeout);
		if (token === generation) supplementalLoading.value = false;
	}
};
const refresh = async () => {
	if (disposed) return;
	await Promise.all([load(), supplemental()]);
};
watch(
	() => props.spaceId,
	() => {
		resumeController?.abort();
		draft.value = null;
		baseline.value = null;
		revision.value = 0;
		state.value = null;
		sensors.value = [];
		void supplemental();
	},
	{ immediate: true }
);
const discard = () => {
	if (configuration.value) {
		reset();
		error.value = null;
	}
};
const submit = () => {
	if (!canSave.value || !draft.value || submission) return;
	submitting.value = true;
	submission = (async () => {
		if (await save(revision.value, draft.value!)) reset();
		await supplemental();
	})().finally(() => {
		submission = null;
		submitting.value = false;
	});
	return submission;
};
const resume = () => {
	if (!canEdit.value || !configuration.value || submission || busy.value || loading.value || dirty.value) return;
	const id = props.spaceId;
	const expected = configuration.value.revision;
	let outcomeError: 'conflict' | 'saveUnconfirmed' | null = null;
	submitting.value = true;
	submission = (async () => {
		const abort = new AbortController();
		resumeController = abort;
		const timeout = setTimeout(() => abort.abort(), 10_000);
		try {
			const result = await client.POST('/modules/spaces/spaces/{id}/occupancy/resume', {
				params: { path: { id } },
				body: { data: { expected_revision: expected } },
				signal: abort.signal,
			});
			if (result.response.status === 409) outcomeError = 'conflict';
			else if (result.error) throw new Error('resumeFailed');
		} catch {
			outcomeError = 'saveUnconfirmed';
			if (!disposed && props.spaceId === id) error.value = 'saveUnconfirmed';
		} finally {
			clearTimeout(timeout);
			if (resumeController === abort) resumeController = null;
		}
		if (!disposed && props.spaceId === id) {
			await refresh();
			// A GET can precede the original POST's late commit; it cannot confirm that response.
			if (outcomeError && !disposed && props.spaceId === id) error.value = outcomeError;
		}
	})().finally(() => {
		submission = null;
		submitting.value = false;
	});
	return submission;
};
defineExpose({ hasUnsavedChanges: dirty, waitForSave: () => submission ?? Promise.resolve() });
onScopeDispose(() => {
	disposed = true;
	generation++;
	controller?.abort();
	resumeController?.abort();
});
</script>
