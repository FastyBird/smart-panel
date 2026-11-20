import { computed } from 'vue';

import { useMediaQuery, useBreakpoints as vueUseBreakpoints } from '@vueuse/core';

import { SIZE_CLASS_BREAKPOINTS } from '../common.constants';

import type { IUseSizeClass, SizeClass } from './types';

const breakpoints = vueUseBreakpoints(SIZE_CLASS_BREAKPOINTS);

export const useSizeClass = (): IUseSizeClass => {
	const sizeClass = computed<SizeClass>((): SizeClass => {
		if (breakpoints.wd.value) {
			return 'wd';
		}

		if (breakpoints.dt.value) {
			return 'dt';
		}

		if (breakpoints.tl.value) {
			return 'tl';
		}

		if (breakpoints.tp.value) {
			return 'tp';
		}

		return 'phone';
	});

	// Touch screens get larger controls (section 6); a mouse next to a touch screen keeps the default size
	const isTouch = useMediaQuery('(pointer: coarse)');

	return {
		sizeClass,
		isPhone: computed<boolean>((): boolean => sizeClass.value === 'phone'),
		isTabletPortrait: computed<boolean>((): boolean => sizeClass.value === 'tp'),
		isTabletLandscape: computed<boolean>((): boolean => sizeClass.value === 'tl'),
		isDesktop: computed<boolean>((): boolean => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed<boolean>((): boolean => isTouch.value),
	};
};
