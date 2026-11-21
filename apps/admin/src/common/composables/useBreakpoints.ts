import { computed } from 'vue';

import { breakpointsBootstrapV5, useBreakpoints as vueUseBreakpoints } from '@vueuse/core';

import { SIZE_CLASS_BREAKPOINTS } from '../common.constants';

import type { IUseBreakpoints } from './types';

// `md` starts at the tablet size class (720 px) instead of Bootstrap's 768 px, so code that still asks
// `isMDDevice` switches between the phone and the tablet layout together with the shell (spec section 6)
const breakpoints = vueUseBreakpoints({ ...breakpointsBootstrapV5, md: SIZE_CLASS_BREAKPOINTS.tp });

// VueUse's breakpoint properties are getters that start a new media-query listener on every read, so each one is
// read once here and the computed values below only read these refs
const { xs, sm, md, lg, xl, xxl } = breakpoints;

export const useBreakpoints = (): IUseBreakpoints => {
	const isXSDevice = computed<boolean>((): boolean => xs.value);
	const isSMDevice = computed<boolean>((): boolean => sm.value);
	const isMDDevice = computed<boolean>((): boolean => md.value);
	const isLGDevice = computed<boolean>((): boolean => lg.value);
	const isXLDevice = computed<boolean>((): boolean => xl.value);
	const isXXLDevice = computed<boolean>((): boolean => xxl.value);

	return {
		isXSDevice,
		isSMDevice,
		isMDDevice,
		isLGDevice,
		isXLDevice,
		isXXLDevice,
	};
};
