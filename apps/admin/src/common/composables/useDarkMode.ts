import { computed } from 'vue';

import { useDark, useToggle } from '@vueuse/core';

import type { IUseDarkMode } from './types';

export function useDarkMode(): IUseDarkMode {
	const darkMode = useDark({
		storageKey: 'fb-theme-appearance',
	});

	const isDark = computed<boolean>((): boolean => {
		return darkMode.value;
	});

	const toggleDark = useToggle(darkMode);

	return {
		isDark,
		toggleDark,
	};
}
