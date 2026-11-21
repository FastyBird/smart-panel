import { computed } from 'vue';

import { useMediaQuery, useBreakpoints as vueUseBreakpoints } from '@vueuse/core';

import { SIZE_CLASS_BREAKPOINTS } from '../common.constants';

import type { IUseSizeClass, SizeClass } from './types';

const breakpoints = vueUseBreakpoints(SIZE_CLASS_BREAKPOINTS);

// VueUse's breakpoint properties are getters that start a new media-query listener on every read: read each once
const { tp, tl, dt, wd } = breakpoints;

// Touch screens get larger controls (section 6); a mouse next to a touch screen keeps the default size
const coarsePointer = useMediaQuery('(pointer: coarse)');

export const useSizeClass = (): IUseSizeClass => {
	const sizeClass = computed<SizeClass>((): SizeClass => {
		if (wd.value) {
			return 'wd';
		}

		if (dt.value) {
			return 'dt';
		}

		if (tl.value) {
			return 'tl';
		}

		if (tp.value) {
			return 'tp';
		}

		return 'phone';
	});

	return {
		sizeClass,
		isPhone: computed<boolean>((): boolean => sizeClass.value === 'phone'),
		isTabletPortrait: computed<boolean>((): boolean => sizeClass.value === 'tp'),
		isTabletLandscape: computed<boolean>((): boolean => sizeClass.value === 'tl'),
		isDesktop: computed<boolean>((): boolean => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed<boolean>((): boolean => coarsePointer.value),
	};
};
