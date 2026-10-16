import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useBackend } from '../../../common';
import type { components } from '../../../openapi';

type GroupConfiguration = components['schemas']['DevicesVirtualPluginDataLightGroupConfiguration'];
type GroupDraft = components['schemas']['DevicesVirtualPluginDataLightGroupDraft'];
type CreateGroup = components['schemas']['DevicesVirtualPluginCreateLightGroupDraft'];
type PreviewGroup = components['schemas']['DevicesVirtualPluginLightGroupDraft'];

/** One request generation owns feedback; stale previews cannot enable a newer draft's save. */
export const useLightGroupAuthoring = () => {
	const backend = useBackend();
	const { t } = useI18n();
	const configuration = ref<GroupConfiguration | null>(null);
	const preview = ref<GroupDraft | null>(null);
	const pending = ref(false);
	const error = ref<string | null>(null);
	const repairConflict = ref(false);
	let generation = 0;
	let previewKey: string | null = null;

	const describeError = (value: unknown): string => {
		if (value instanceof Error) return value.message;
		if (typeof value === 'object' && value !== null && 'message' in value && typeof value.message === 'string') return value.message;
		return t('devicesVirtualPlugin.lightGroup.loadFailed');
	};
	const invalidatePreview = () => {
		generation++;
		preview.value = null;
		previewKey = null;
		pending.value = false;
	};
	const key = (draft: PreviewGroup) =>
		JSON.stringify({ profile: draft.profile ?? 'light', members: draft.members, capabilities: draft.capabilities });

	const load = async (id: string) => {
		const current = ++generation;
		pending.value = true;
		error.value = null;
		try {
			const result = await backend.client.GET('/plugins/devices-virtual/producers/light-groups/{id}', { params: { path: { id } } });
			if (current !== generation) return null;
			if (!result.data) throw new Error(describeError(result.error));
			configuration.value = result.data.data;
			return result.data.data;
		} catch (cause) {
			if (current === generation) error.value = describeError(cause);
			return null;
		} finally {
			if (current === generation) pending.value = false;
		}
	};

	const previewDraft = async (draft: PreviewGroup) => {
		const current = ++generation;
		preview.value = null;
		previewKey = null;
		pending.value = true;
		error.value = null;
		try {
			const result = await backend.client.POST('/plugins/devices-virtual/producers/light-groups/draft-preview', { body: draft });
			if (current !== generation) return null;
			if (!result.data) throw new Error(describeError(result.error));
			preview.value = result.data.data;
			previewKey = key(draft);
			return result.data.data;
		} catch (cause) {
			if (current === generation) error.value = describeError(cause);
			return null;
		} finally {
			if (current === generation) pending.value = false;
		}
	};

	const create = async (draft: CreateGroup) => {
		if (!preview.value || previewKey !== key(draft)) throw new Error(t('devicesVirtualPlugin.lightGroup.previewRequired'));
		const current = ++generation;
		pending.value = true;
		error.value = null;
		repairConflict.value = false;
		try {
			const result = await backend.client.POST('/plugins/devices-virtual/producers/light-groups', {
				body: { ...draft, expected_graph_revision: preview.value.graph_revision },
			});
			if (current !== generation) return null;
			if (!result.data) {
				repairConflict.value = result.response.status === 409 || result.response.status === 422;
				throw new Error(describeError(result.error));
			}
			invalidatePreview();
			return result.data.data;
		} catch (cause) {
			if (current === generation) error.value = describeError(cause);
			return null;
		} finally {
			if (current === generation) pending.value = false;
		}
	};

	return { configuration, preview, pending, error, repairConflict, load, previewDraft, create, invalidatePreview };
};
