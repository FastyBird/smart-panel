import { computed } from 'vue';

import { breakpointsBootstrapV5, useBreakpoints as vueUseBreakpoints } from '@vueuse/core';

import { SIZE_CLASS_BREAKPOINTS } from '../common.constants';

import type { IUseBreakpoints } from './types';

// `md` starts at the tablet size class (720 px) instead of Bootstrap's 768 px, so code that still asks
// `isMDDevice` switches between the phone and the tablet layout together with the shell (spec section 6)
const breakpoints = vueUseBreakpoints({ ...breakpointsBootstrapV5, md: SIZE_CLASS_BREAKPOINTS.tp });

export const useBreakpoints = (): IUseBreakpoints => {
	const isXSDevice = computed<boolean>((): boolean => breakpoints.xs.value);
	const isSMDevice = computed<boolean>((): boolean => breakpoints.sm.value);
	const isMDDevice = computed<boolean>((): boolean => breakpoints.md.value);
	const isLGDevice = computed<boolean>((): boolean => breakpoints.lg.value);
	const isXLDevice = computed<boolean>((): boolean => breakpoints.xl.value);
	const isXXLDevice = computed<boolean>((): boolean => breakpoints.xxl.value);

	return {
		isXSDevice,
		isSMDevice,
		isMDDevice,
		isLGDevice,
		isXLDevice,
		isXXLDevice,
	};
};
