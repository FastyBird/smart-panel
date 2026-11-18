import { type MaybeRefOrGetter, toValue, watch } from 'vue';

import { useFlashMessage } from '../../../common';

/** Report request failures once per occurrence without replacing or resizing the wizard content. */
export function useVirtualWizardError(error: MaybeRefOrGetter<string | null | undefined | false>) {
	const flashMessage = useFlashMessage();
	watch(
		() => toValue(error),
		(message) => {
			if (message) flashMessage.error(message);
		},
		{ immediate: true }
	);
	return flashMessage.error;
}
