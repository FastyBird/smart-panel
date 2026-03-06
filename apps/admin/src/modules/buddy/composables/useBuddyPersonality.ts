import { type Ref, ref } from 'vue';

import { useBackend } from '../../../common';
import { MODULES_PREFIX } from '../../../app.constants';
import { BUDDY_MODULE_PREFIX } from '../buddy.constants';

interface IUseBuddyPersonality {
	personalityContent: Ref<string>;
	personalityLoading: Ref<boolean>;
	personalityError: Ref<string | null>;
	fetchPersonality: () => Promise<void>;
	savePersonality: (content: string) => Promise<boolean>;
}

export const useBuddyPersonality = (): IUseBuddyPersonality => {
	const backend = useBackend();

	const personalityContent = ref<string>('');
	const personalityLoading = ref<boolean>(false);
	const personalityError = ref<string | null>(null);

	const fetchPersonality = async (): Promise<void> => {
		personalityLoading.value = true;
		personalityError.value = null;

		try {
			const response = await backend.client.GET(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/personality` as never);

			const res = response as { data?: { data: { content: string } }; error?: unknown };

			if (typeof res.data !== 'undefined') {
				personalityContent.value = res.data.data.content;
			} else {
				personalityError.value = 'Failed to load personality';
			}
		} catch {
			personalityError.value = 'Failed to load personality';
		} finally {
			personalityLoading.value = false;
		}
	};

	const savePersonality = async (content: string): Promise<boolean> => {
		personalityLoading.value = true;
		personalityError.value = null;

		try {
			const response = await backend.client.PATCH(`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/personality` as never, {
				body: { data: { content } },
			} as never);

			const res = response as { data?: { data: { content: string } }; error?: unknown; response?: { status?: number } };
			const status = res.response?.status;

			if (status && status >= 400) {
				personalityError.value = 'Failed to save personality';

				return false;
			}

			if (typeof res.data !== 'undefined') {
				personalityContent.value = res.data.data.content;
			}

			return true;
		} catch {
			personalityError.value = 'Failed to save personality';

			return false;
		} finally {
			personalityLoading.value = false;
		}
	};

	return {
		personalityContent,
		personalityLoading,
		personalityError,
		fetchPersonality,
		savePersonality,
	};
};
