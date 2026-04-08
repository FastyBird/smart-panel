import { type Ref, ref } from 'vue';
import { useI18n } from 'vue-i18n';

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
	const { t } = useI18n();
	const backend = useBackend();

	const personalityContent = ref<string>('');
	const personalityLoading = ref<boolean>(false);
	const personalityError = ref<string | null>(null);

	const fetchPersonality = async (): Promise<void> => {
		personalityLoading.value = true;
		personalityError.value = null;

		try {
			const { data: responseData, error: apiError, response: res } = await backend.client.GET(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/personality`,
			);

			if (res?.status === 503) {
				personalityError.value = t('buddyModule.messages.errors.providerUnavailable');

				return;
			}

			if (apiError || !responseData) {
				personalityError.value = t('buddyModule.messages.errors.loadPersonality');

				return;
			}

			personalityContent.value = (responseData.data as { content: string }).content;
		} catch {
			personalityError.value = t('buddyModule.messages.errors.loadPersonality');
		} finally {
			personalityLoading.value = false;
		}
	};

	const savePersonality = async (content: string): Promise<boolean> => {
		personalityLoading.value = true;
		personalityError.value = null;

		try {
			const { data: responseData, error: apiError, response: res } = await backend.client.PATCH(
				`/${MODULES_PREFIX}/${BUDDY_MODULE_PREFIX}/personality`,
				{
					body: { data: { content } },
				},
			);

			if (res?.status === 503) {
				personalityError.value = t('buddyModule.messages.errors.providerUnavailable');

				return false;
			}

			if (apiError || !responseData) {
				personalityError.value = t('buddyModule.messages.errors.savePersonality');

				return false;
			}

			personalityContent.value = (responseData.data as { content: string }).content;

			return true;
		} catch {
			personalityError.value = t('buddyModule.messages.errors.savePersonality');

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
