import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useBackend } from '../../../common';
import type { components } from '../../../openapi';

type Request = components['schemas']['DevicesVirtualPluginGroupCatalog'];
export type GroupProfile = NonNullable<Request['profile']>;
export type GroupCatalog = components['schemas']['DevicesVirtualPluginDataGroupCatalog'];
/** A delayed response from a previous profile/member selection cannot replace current compatibility. */
export const useGroupCatalog = () => {
	const backend = useBackend();
	const { t } = useI18n();
	const catalog = ref<GroupCatalog | null>(null);
	const profiles = ref<GroupCatalog['profiles']>([]);
	const error = ref<string | null>(null);
	const pending = ref(false);
	let generation = 0;
	const invalidate = () => {
		generation++;
		catalog.value = null;
		pending.value = false;
	};
	const load = async (request: Request) => {
		const current = ++generation;
		catalog.value = null;
		pending.value = true;
		error.value = null;
		try {
			const result = await backend.client.POST('/plugins/devices-virtual/producers/light-group-candidates', { body: request });
			if (current !== generation) return null;
			if (!result.data)
				throw new Error(
					result.error && typeof result.error === 'object' && 'message' in result.error
						? String(result.error.message)
						: t('devicesVirtualPlugin.lightGroup.readinessUnavailable')
				);
			catalog.value = result.data.data;
			profiles.value = result.data.data.profiles;
			return result.data.data;
		} catch (cause) {
			if (current === generation) error.value = cause instanceof Error ? cause.message : t('devicesVirtualPlugin.lightGroup.readinessUnavailable');
			return null;
		} finally {
			if (current === generation) pending.value = false;
		}
	};
	return { catalog, profiles, error, pending, load, invalidate };
};
