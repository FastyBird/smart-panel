import { type Ref, computed, onScopeDispose, ref, watch } from 'vue';

import { cloneDeep } from 'lodash';

import { useBackend } from '../../../common';
import type { components } from '../../../openapi';
import { PathsModulesSpacesSpacesIdActivityModesModeConfigGetParametersPathMode as ActivityMode } from '../../../openapi';

export { ActivityMode };
export type ActivityConfig = components['schemas']['SpacesHomeControlPluginDataSpaceActivityConfigEntity'];
export type ActivityConfiguration = components['schemas']['SpacesHomeControlPluginDataActivityConfiguration'];
export type ActivityPreview = components['schemas']['SpacesHomeControlPluginDataActivityDomainResult'][];
export type ActivityDraft = Pick<components['schemas']['SpacesHomeControlPluginUpdateActivityMode'], 'enabled' | 'display_order' | 'configuration'>;

export const activityDraft = (config: ActivityConfig): ActivityDraft => ({
	enabled: config.activity_enabled,
	display_order: config.activity_order,
	configuration: cloneDeep(config.activity_configuration),
});

// Configuration reads include disabled built-ins. The availability endpoint intentionally does not.
export const useSpaceActivityModes = (spaceId: Ref<string | undefined>) => {
	const { client } = useBackend();
	const configs = ref<ActivityConfig[]>([]);
	const loading = ref(false);
	const busy = ref(false);
	const error = ref<'loadFailed' | 'saveFailed' | 'conflict' | null>(null);
	let generation = 0;
	const base = '/modules/spaces/spaces/{id}/activity-modes' as const;
	const sorted = computed(() =>
		[...configs.value].sort((a, b) => a.activity_order - b.activity_order || a.activity_mode.localeCompare(b.activity_mode))
	);
	const current = (id: string, token: number) => id === spaceId.value && token === generation;
	const read = async (id: string, mode: ActivityMode): Promise<ActivityConfig> => {
		const result = await client.GET(`${base}/{mode}/config`, { params: { path: { id, mode } } });
		if (result.error || !result.data?.data) throw new Error('loadFailed');
		return result.data.data;
	};
	const load = async () => {
		const id = spaceId.value;
		const token = ++generation;
		if (!id) return;
		loading.value = true;
		error.value = null;
		try {
			const rows = await Promise.all(Object.values(ActivityMode).map((mode) => read(id, mode)));
			if (current(id, token)) configs.value = rows;
		} catch {
			if (current(id, token)) error.value = 'loadFailed';
		} finally {
			if (current(id, token)) loading.value = false;
		}
	};
	const replace = (row: ActivityConfig) => {
		configs.value = configs.value.map((old) => (old.activity_mode === row.activity_mode ? row : old));
	};
	const write = async (mode: ActivityMode, expectedRevision: number, draft?: ActivityDraft): Promise<ActivityConfig | null> => {
		const id = spaceId.value;
		if (!id || busy.value || loading.value) return null;
		const token = ++generation;
		busy.value = true;
		error.value = null;
		try {
			const params = { path: { id, mode } };
			const result = draft
				? await client.PUT(`${base}/{mode}/config`, { params, body: { data: { ...draft, expected_revision: expectedRevision } } })
				: await client.POST(`${base}/{mode}/config/reset`, { params, body: { data: { expected_revision: expectedRevision } } });
			if (!current(id, token)) return null;
			if (result.response.status === 409) {
				error.value = 'conflict';
				// Refresh truth without replacing the editor's independent draft or retrying the write.
				const row = await read(id, mode);
				if (current(id, token)) replace(row);
				return null;
			}
			if (result.error || !result.data?.data) throw new Error('saveFailed');
			replace(result.data.data);
			return result.data.data;
		} catch {
			if (current(id, token) && error.value !== 'conflict') error.value = 'saveFailed';
			return null;
		} finally {
			if (current(id, token)) busy.value = false;
		}
	};
	const preview = async (mode: ActivityMode, revision: number): Promise<ActivityPreview> => {
		const id = spaceId.value;
		if (!id) throw new Error('loadFailed');
		const token = generation;
		const result = await client.POST(`${base}/{mode}/preview`, { params: { path: { id, mode } }, body: { data: { expected_revision: revision } } });
		if (!current(id, token)) throw new Error('loadFailed');
		if (result.response.status === 409) {
			error.value = 'conflict';
			const row = await read(id, mode);
			if (current(id, token)) replace(row);
			throw new Error('conflict');
		}
		if (result.error || !result.data?.data) throw new Error('loadFailed');
		return result.data.data;
	};
	watch(
		spaceId,
		() => {
			configs.value = [];
			busy.value = false;
			void load();
		},
		{ immediate: true }
	);
	onScopeDispose(() => {
		generation++;
	});
	return { configs: sorted, loading, busy, error, load, write, preview };
};
