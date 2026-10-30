import { type Ref, onScopeDispose, ref, watch } from 'vue';

import { cloneDeep } from 'lodash';

import { useBackend } from '../../../common';
import type { components } from '../../../openapi';

export type ScheduleConfiguration = components['schemas']['SpacesHomeControlPluginDataSpaceModeScheduleEntity'];
export type ScheduleEntry = components['schemas']['SpacesHomeControlPluginDataScheduleEntry'];
export type ScheduleDraft = Pick<components['schemas']['SpacesHomeControlPluginUpdateSchedule'], 'enabled' | 'timezone' | 'entries'>;

export const scheduleDraft = (row: ScheduleConfiguration): ScheduleDraft => ({
	enabled: row.enabled,
	timezone: row.timezone,
	entries: cloneDeep(row.entries),
});

export const useSpaceModeSchedule = (spaceId: Ref<string | undefined>) => {
	const { client } = useBackend();
	const configuration = ref<ScheduleConfiguration | null>(null);
	const loading = ref(false);
	const busy = ref(false);
	const error = ref<'loadFailed' | 'saveFailed' | 'conflict' | 'invalid' | null>(null);
	let generation = 0;
	const path = '/modules/spaces/spaces/{id}/schedules' as const;
	const current = (id: string, token: number) => spaceId.value === id && token === generation;
	const read = async (id: string) => {
		const result = await client.GET(path, { params: { path: { id } } });
		if (result.error || !result.data?.data || result.data.data.space_id !== id) throw new Error('loadFailed');
		return result.data.data;
	};
	const load = async () => {
		const id = spaceId.value;
		if (!id || busy.value) return;
		const token = ++generation;
		loading.value = true;
		error.value = null;
		try {
			const row = await read(id);
			if (current(id, token)) configuration.value = row;
		} catch {
			if (current(id, token)) error.value = 'loadFailed';
		} finally {
			if (current(id, token)) loading.value = false;
		}
	};
	const save = async (expectedRevision: number, draft: ScheduleDraft): Promise<ScheduleConfiguration | null> => {
		const id = spaceId.value;
		if (!id || busy.value || loading.value || error.value === 'conflict' || configuration.value?.revision !== expectedRevision) return null;
		const token = ++generation;
		busy.value = true;
		error.value = null;
		try {
			const result = await client.PUT(path, {
				params: { path: { id } },
				body: { data: { ...cloneDeep(draft), timezone: draft.timezone ?? null, expected_revision: expectedRevision } },
			});
			if (!current(id, token)) return null;
			if (result.response.status === 409) {
				error.value = 'conflict';
				try {
					const row = await read(id);
					if (current(id, token)) configuration.value = row;
				} catch {
					if (current(id, token)) error.value = 'loadFailed';
				}
				return null;
			}
			if (result.response.status === 400 || result.response.status === 422) {
				error.value = 'invalid';
				return null;
			}
			if (result.error || !result.data?.data || result.data.data.space_id !== id) throw new Error('saveFailed');
			configuration.value = result.data.data;
			return result.data.data;
		} catch {
			if (current(id, token) && error.value !== 'conflict') error.value = 'saveFailed';
			return null;
		} finally {
			if (current(id, token)) busy.value = false;
		}
	};
	watch(
		spaceId,
		() => {
			generation++;
			configuration.value = null;
			busy.value = false;
			loading.value = false;
			error.value = null;
			void load();
		},
		{ immediate: true }
	);
	onScopeDispose(() => {
		generation++;
	});
	return { configuration, loading, busy, error, load, save };
};
