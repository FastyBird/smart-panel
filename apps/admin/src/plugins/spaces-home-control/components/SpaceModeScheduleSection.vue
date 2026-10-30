<template>
	<el-card
		v-loading="loading"
		shadow="never"
		class="m-2"
	>
		<template #header>
			<h3 class="m-0">{{ text('title') }}</h3>
		</template>
		<p>{{ text('description') }}</p>
		<el-alert
			v-if="error"
			:title="text(error)"
			type="warning"
			:closable="false"
			show-icon
		/>
		<el-button
			v-if="error === 'loadFailed' || error === 'conflict'"
			data-testid="schedule-refresh"
			@click="load"
		>
			{{ text('refresh') }}
		</el-button>
		<template v-if="draft">
			<p v-if="!canEdit">{{ text('readOnly') }}</p>
			<el-form
				label-position="top"
				:disabled="!canEdit || busy || loading"
			>
				<el-form-item :label="text('enabled')">
					<el-switch
						v-model="draft.enabled"
						data-testid="schedule-enabled"
						:aria-label="text('enabled')"
					/>
				</el-form-item>
				<el-form-item :label="text('timezone')">
					<el-select
						:model-value="draft.timezone ?? ''"
						filterable
						allow-create
						default-first-option
						data-testid="schedule-timezone"
						@update:model-value="
							(value: string) => {
								if (draft) draft.timezone = value || null;
							}
						"
					>
						<el-option
							value=""
							:label="text('houseTimezone')"
						/>
						<el-option
							v-for="zone in timezones"
							:key="zone"
							:value="zone"
							:label="zone"
						/>
					</el-select>
				</el-form-item>
			</el-form>
			<p>{{ text('clockPolicy') }}</p>
			<div class="overflow-x-auto">
				<table
					class="w-full border-collapse"
					:aria-label="text('weeklyView')"
				>
					<thead>
						<tr>
							<th
								v-for="day in weekdays"
								:key="day"
								scope="col"
								class="p-2"
							>
								{{ text(`days.${day}`) }}
							</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td
								v-for="day in weekdays"
								:key="day"
								class="align-top p-2"
							>
								<ul class="list-none p-0 m-0">
									<li
										v-for="item in entriesFor(day)"
										:key="item.id"
										class="mb-2"
									>
										<el-button
											:disabled="!canEdit || busy || loading"
											@click="edit(item)"
										>
											{{ item.time }} · {{ modeText(item.mode) }}
										</el-button>
										<span v-if="!item.enabled">{{ text('entryDisabled') }}</span>
									</li>
								</ul>
							</td>
						</tr>
					</tbody>
				</table>
			</div>
			<p v-if="!draft.entries.length">{{ text('empty') }}</p>
			<el-alert
				v-if="!valid"
				:title="text('invalid')"
				type="warning"
				:closable="false"
			/>
			<el-button
				:disabled="!canEdit || busy || loading || draft.entries.length >= 64"
				data-testid="schedule-add"
				@click="add"
			>
				{{ text('add') }}
			</el-button>
			<el-button
				:disabled="!canSave"
				:loading="busy"
				data-testid="schedule-save"
				@click="submit"
			>
				{{ text('save') }}
			</el-button>
			<el-button
				:disabled="busy || loading || !dirty"
				data-testid="schedule-discard"
				@click="discard"
			>
				{{ text('discard') }}
			</el-button>
			<p v-if="dirty">{{ text('unsaved') }}</p>
			<p v-if="error === 'conflict' || (dirty && configuration?.revision !== revision)">{{ text('conflictHelp') }}</p>
		</template>
	</el-card>
	<el-dialog
		v-model="editing"
		:title="text('editEntry')"
		width="min(520px, 94vw)"
		:close-on-click-modal="false"
		destroy-on-close
	>
		<el-form
			v-if="entry"
			label-position="top"
			:disabled="!canEdit || busy"
		>
			<el-form-item :label="text('mode')">
				<el-select
					v-model="entry.mode"
					data-testid="schedule-entry-mode"
				>
					<el-option
						v-for="mode in modes"
						:key="mode"
						:value="mode"
						:label="modeText(mode)"
					/>
				</el-select>
			</el-form-item>
			<el-form-item :label="text('time')">
				<el-input
					v-model="entry.time"
					type="time"
					data-testid="schedule-entry-time"
				/>
			</el-form-item>
			<el-form-item :label="text('pattern')">
				<el-select
					:model-value="pattern"
					data-testid="schedule-pattern"
					@update:model-value="setPattern"
				>
					<el-option
						v-for="value in ['daily', 'weekdays', 'weekend', 'custom']"
						:key="value"
						:value="value"
						:label="text(`patterns.${value}`)"
					/>
				</el-select>
			</el-form-item>
			<el-form-item :label="text('daysLabel')">
				<el-checkbox-group v-model="entry.days_of_week">
					<el-checkbox
						v-for="day in weekdays"
						:key="day"
						:value="day"
					>
						{{ text(`days.${day}`) }}
					</el-checkbox>
				</el-checkbox-group>
			</el-form-item>
			<el-form-item :label="text('entryEnabled')"><el-switch v-model="entry.enabled" /></el-form-item>
		</el-form>
		<template #footer>
			<el-button
				v-if="entry && draft?.entries.some((item) => item.id === entry?.id)"
				type="danger"
				data-testid="schedule-entry-delete"
				:disabled="!canEdit || busy"
				@click="remove"
			>
				{{ text('remove') }}
			</el-button>
			<el-button @click="editing = false">{{ text('cancel') }}</el-button>
			<el-button
				type="primary"
				data-testid="schedule-entry-apply"
				:disabled="!entryValid || !canEdit || busy"
				@click="apply"
			>
				{{ text('apply') }}
			</el-button>
		</template>
	</el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	ElAlert,
	ElButton,
	ElCard,
	ElCheckbox,
	ElCheckboxGroup,
	ElDialog,
	ElForm,
	ElFormItem,
	ElInput,
	ElOption,
	ElSelect,
	ElSwitch,
	vLoading,
} from 'element-plus';
import { cloneDeep } from 'lodash';
import { v4 as uuid } from 'uuid';

import { useSession } from '../../../modules/auth/composables/useSession';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { ActivityMode } from '../composables/useSpaceActivityModes';
import { type ScheduleDraft, type ScheduleEntry, scheduleDraft, useSpaceModeSchedule } from '../composables/useSpaceModeSchedule';

const props = defineProps<{ spaceId: string }>();
const { t } = useI18n();
const text = (key: string) => t(`spacesHomeControlPlugin.schedules.${key}`);
const modeText = (mode: string) => t(`spacesHomeControlPlugin.activityModes.modes.${mode}`);
const { profile } = useSession();
const canEdit = computed(() => profile.value?.role === UsersModuleUserRole.owner || profile.value?.role === UsersModuleUserRole.admin);
const { configuration, loading, busy, error, load, save } = useSpaceModeSchedule(computed(() => props.spaceId));
const draft = ref<ScheduleDraft | null>(null);
const baseline = ref<ScheduleDraft | null>(null);
const revision = ref(0);
const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(baseline.value));
const modes = Object.values(ActivityMode) as ScheduleEntry['mode'][];
const weekdays = [1, 2, 3, 4, 5, 6, 0];
const timezones = [...new Set(['UTC', ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [])])];
const editing = ref(false);
const entry = ref<ScheduleEntry | null>(null);
const entryValid = computed(() => !!entry.value && /^([01]\d|2[0-3]):[0-5]\d$/.test(entry.value.time) && entry.value.days_of_week.length > 0);
const valid = computed(() => {
	if (!draft.value) return false;
	if (draft.value.timezone && /^[+-]/.test(draft.value.timezone)) return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone: draft.value.timezone ?? 'UTC' }).format();
	} catch {
		return false;
	}
	const occupied = new Set<string>();
	for (const item of draft.value.entries) {
		if (!item.enabled) continue;
		for (const day of item.days_of_week) {
			const key = `${day}|${item.time}`;
			if (occupied.has(key)) return false;
			occupied.add(key);
		}
	}
	return true;
});
defineExpose({ hasUnsavedChanges: computed(() => dirty.value || editing.value) });
const canSave = computed(
	() =>
		configuration.value?.revision === revision.value &&
		canEdit.value &&
		dirty.value &&
		valid.value &&
		!loading.value &&
		!busy.value &&
		error.value !== 'conflict' &&
		error.value !== 'loadFailed'
);
const reset = () => {
	if (!configuration.value) return;
	draft.value = scheduleDraft(configuration.value);
	baseline.value = cloneDeep(draft.value);
	revision.value = configuration.value.revision;
};
watch(configuration, () => {
	if (!dirty.value) reset();
});
watch(
	() => props.spaceId,
	() => {
		draft.value = null;
		baseline.value = null;
		revision.value = 0;
		editing.value = false;
		entry.value = null;
	}
);
const discard = () => {
	reset();
	error.value = null;
};
const entriesFor = (day: number) =>
	[...(draft.value?.entries ?? [])].filter((item) => item.days_of_week.includes(day)).sort((a, b) => a.time.localeCompare(b.time));
const add = () => {
	entry.value = { id: uuid(), mode: modes[0]!, time: '08:00', days_of_week: [1, 2, 3, 4, 5], enabled: true };
	editing.value = true;
};
const edit = (item: ScheduleEntry) => {
	entry.value = cloneDeep(item);
	editing.value = true;
};
const pattern = computed(() => {
	const days = [...(entry.value?.days_of_week ?? [])].sort().join(',');
	return days === '0,1,2,3,4,5,6' ? 'daily' : days === '1,2,3,4,5' ? 'weekdays' : days === '0,6' ? 'weekend' : 'custom';
});
const setPattern = (value: string) => {
	if (!entry.value || value === 'custom') return;
	entry.value.days_of_week = value === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : value === 'weekdays' ? [1, 2, 3, 4, 5] : [0, 6];
};
const apply = () => {
	if (!entry.value || !draft.value || !entryValid.value || !canEdit.value) return;
	const index = draft.value.entries.findIndex((item) => item.id === entry.value?.id);
	if (index < 0) draft.value.entries.push(cloneDeep(entry.value));
	else draft.value.entries[index] = cloneDeep(entry.value);
	editing.value = false;
};
const remove = () => {
	if (draft.value && entry.value && canEdit.value) draft.value.entries = draft.value.entries.filter((item) => item.id !== entry.value?.id);
	editing.value = false;
};
const submit = async () => {
	if (!draft.value || !canSave.value) return;
	const row = await save(revision.value, draft.value);
	if (row) reset();
};
</script>
