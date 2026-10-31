import { type Ref, onScopeDispose, ref, watch } from 'vue';

import { cloneDeep } from 'lodash';

import { useBackend } from '../../../common';
import type { components } from '../../../openapi';

export type OccupancyConfiguration = components['schemas']['SpacesHomeControlPluginDataOccupancyConfiguration'];
export type OccupancyDraft = Pick<
	components['schemas']['SpacesHomeControlPluginUpdateOccupancy'],
	'enabled' | 'vacancy_timeout_seconds' | 'maximum_age_seconds' | 'sensor_property_ids' | 'occupied_mode' | 'vacant_mode'
>;

export const occupancyDraft = (row: OccupancyConfiguration): OccupancyDraft => ({
	enabled: row.enabled,
	vacancy_timeout_seconds: row.vacancy_timeout_seconds,
	maximum_age_seconds: row.maximum_age_seconds,
	sensor_property_ids: [...row.sensor_property_ids],
	occupied_mode: row.occupied_mode,
	vacant_mode: row.vacant_mode,
});

export const useSpaceOccupancy = (spaceId: Ref<string | undefined>) => {
	const { client } = useBackend();
	const configuration = ref<OccupancyConfiguration | null>(null);
	const loading = ref(false);
	const busy = ref(false);
	const error = ref<'loadFailed' | 'saveUnconfirmed' | 'conflict' | 'invalid' | null>(null);
	let generation = 0;
	let disposed = false;
	let activeSave: AbortController | null = null;
	let activeLoad: AbortController | null = null;
	const path = '/modules/spaces/spaces/{id}/occupancy' as const;
	const current = (id: string, token: number) => !disposed && spaceId.value === id && token === generation;
	const read = async (id: string, signal?: AbortSignal) => {
		const result = await client.GET(path, { params: { path: { id } }, signal });
		if (result.error || !result.data?.data || result.data.data.space_id !== id) throw new Error('loadFailed');
		return result.data.data;
	};
	const load = async () => {
		const id = spaceId.value;
		if (disposed || !id || busy.value) return;
		const token = ++generation;
		loading.value = true;
		error.value = null;
		activeLoad?.abort();
		const request = new AbortController();
		activeLoad = request;
		const timeout = setTimeout(() => request.abort(), 10_000);
		try {
			const row = await read(id, request.signal);
			if (current(id, token)) configuration.value = row;
		} catch {
			if (current(id, token)) error.value = 'loadFailed';
		} finally {
			clearTimeout(timeout);
			if (activeLoad === request) activeLoad = null;
			if (current(id, token)) loading.value = false;
		}
	};
	const save = async (expectedRevision: number, draft: OccupancyDraft): Promise<OccupancyConfiguration | null> => {
		const id = spaceId.value;
		if (disposed || !id || busy.value || loading.value || error.value === 'conflict' || configuration.value?.revision !== expectedRevision)
			return null;
		const token = ++generation;
		busy.value = true;
		error.value = null;
		const controller = new AbortController();
		activeSave = controller;
		// Include conflict reloads in the save deadline so route guards can always settle.
		const timeout = setTimeout(() => controller.abort(), 30_000);
		try {
			const result = await client.PUT(path, {
				signal: controller.signal,
				params: { path: { id } },
				body: { data: { ...cloneDeep(draft), expected_revision: expectedRevision } },
			});
			if (!current(id, token)) return null;
			if (result.response.status === 409) {
				error.value = 'conflict';
				configuration.value = null;
				try {
					const row = await read(id, controller.signal);
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
			if (!current(id, token)) return null;
			// An interrupted response does not establish whether the server committed.
			// Drop the old baseline before a separately bounded reconciliation read.
			clearTimeout(timeout);
			configuration.value = null;
			error.value = 'saveUnconfirmed';
			const reconciliation = new AbortController();
			activeSave = reconciliation;
			const reconciliationTimeout = setTimeout(() => reconciliation.abort(), 10_000);
			try {
				const row = await read(id, reconciliation.signal);
				if (current(id, token)) configuration.value = row;
			} catch {
				// Keep the draft and unknown outcome; Refresh can recover a current baseline.
			} finally {
				clearTimeout(reconciliationTimeout);
				if (activeSave === reconciliation) activeSave = null;
			}
			return null;
		} finally {
			clearTimeout(timeout);
			if (activeSave === controller) activeSave = null;
			if (current(id, token)) busy.value = false;
		}
	};
	watch(
		spaceId,
		() => {
			generation++;
			activeSave?.abort();
			activeLoad?.abort();
			activeSave = null;
			configuration.value = null;
			busy.value = false;
			loading.value = false;
			error.value = null;
			void load();
		},
		{ immediate: true }
	);
	onScopeDispose(() => {
		disposed = true;
		generation++;
		activeSave?.abort();
		activeLoad?.abort();
	});
	return { configuration, loading, busy, error, load, save };
};
