import { getCurrentScope, onScopeDispose, ref } from 'vue';

import type { IUseKeyboardOffset } from './types';

/**
 * How far the on-screen keyboard covers the bottom of the layout viewport, in px (0 without a keyboard).
 * The layout viewport keeps its height when a touch keyboard opens; `visualViewport` shrinks instead, so the
 * covered part is the layout height minus the visible height and the visual viewport's scroll offset.
 */
export const useKeyboardOffset = (): IUseKeyboardOffset => {
	const offset = ref<number>(0);

	const viewport = typeof window === 'undefined' ? null : window.visualViewport;

	const update = (): void => {
		if (!viewport) {
			offset.value = 0;

			return;
		}

		offset.value = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
	};

	if (viewport) {
		viewport.addEventListener('resize', update);
		viewport.addEventListener('scroll', update);

		update();

		if (getCurrentScope()) {
			onScopeDispose((): void => {
				viewport.removeEventListener('resize', update);
				viewport.removeEventListener('scroll', update);
			});
		}
	}

	return {
		offset,
	};
};
