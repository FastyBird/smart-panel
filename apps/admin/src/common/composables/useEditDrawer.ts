import { type ComputedRef, computed } from 'vue';

import { useSizeClass } from './useSizeClass';

/** How an add or edit form opens over its list (spec section 5, template 4) */
export type EditDrawerMode = 'page' | 'drawer' | 'docked';

export interface IUseEditDrawer {
	/** `page` on phone (own route, app bar with Close and Save), `drawer` from tablet portrait, `docked` on wide */
	mode: ComputedRef<EditDrawerMode>;
	/** The form opens next to the list (drawer or docked) rather than replacing it */
	inDrawer: ComputedRef<boolean>;
	/** Full width on tablet portrait, 640 px above it */
	drawerSize: ComputedRef<string>;
}

export const EDIT_DRAWER_WIDTH = 640;

export const useEditDrawer = (): IUseEditDrawer => {
	const { sizeClass, isPhone, isTabletPortrait } = useSizeClass();

	const mode = computed<EditDrawerMode>((): EditDrawerMode => {
		if (isPhone.value) {
			return 'page';
		}

		// Wide screens have room for the list and the form side by side, so the drawer docks without a scrim
		return sizeClass.value === 'wd' ? 'docked' : 'drawer';
	});

	return {
		mode,
		inDrawer: computed<boolean>((): boolean => mode.value !== 'page'),
		drawerSize: computed<string>((): string => (isTabletPortrait.value ? '100%' : `${EDIT_DRAWER_WIDTH}px`)),
	};
};
