import { type ComputedRef, type InjectionKey, computed, inject, provide, ref, watch } from 'vue';

import { useSizeClass } from './useSizeClass';

/** How an add or edit form opens over its list (spec section 5, template 4) */
export type EditDrawerMode = 'page' | 'drawer' | 'docked';

export interface IUseEditDrawer {
	/** `page` on phone (own route, app bar with Close and Save), `drawer` from tablet portrait, `docked` on wide */
	mode: ComputedRef<EditDrawerMode>;
	/** The form opens next to the list (drawer or docked) rather than replacing it */
	inDrawer: ComputedRef<boolean>;
	/** Full width below tablet landscape, 640 px from it */
	drawerSize: ComputedRef<string>;
}

export const EDIT_DRAWER_WIDTH = 640;

const EDIT_DRAWER: InjectionKey<IUseEditDrawer> = Symbol('fb-edit-drawer');

const liveMode = (): ComputedRef<EditDrawerMode> => {
	const { sizeClass, isPhone } = useSizeClass();

	return computed<EditDrawerMode>((): EditDrawerMode => {
		if (isPhone.value) {
			return 'page';
		}

		// Wide screens have room for the list and the form side by side, so the drawer docks without a scrim
		return sizeClass.value === 'wd' ? 'docked' : 'drawer';
	});
};

const create = (mode: ComputedRef<EditDrawerMode>): IUseEditDrawer => {
	const { isPhone, isTabletPortrait } = useSizeClass();

	return {
		mode,
		inDrawer: computed<boolean>((): boolean => mode.value !== 'page'),
		drawerSize: computed<string>((): string => (isPhone.value || isTabletPortrait.value ? '100%' : `${EDIT_DRAWER_WIDTH}px`)),
	};
};

/**
 * For a list or detail screen that hosts forms. While `open` is true the mode stays the one the form opened in: a
 * window that crosses a size class (a phone turned to landscape crosses 720 px) would otherwise move the form to
 * another outlet and remount it, losing what was typed. The forms below read the same value through `useEditDrawer`
 */
export const provideEditDrawer = (open: () => boolean): IUseEditDrawer => {
	const live = liveMode();

	const latched = ref<EditDrawerMode>(live.value);

	watch(
		open,
		(isOpen: boolean): void => {
			if (isOpen) {
				latched.value = live.value;
			}
		},
		{ immediate: true, flush: 'sync' }
	);

	const editDrawer = create(computed<EditDrawerMode>((): EditDrawerMode => (open() ? latched.value : live.value)));

	provide(EDIT_DRAWER, editDrawer);

	return editDrawer;
};

/** The host screen's value when there is one, so a form and its host agree on drawer or page */
export const useEditDrawer = (): IUseEditDrawer => inject(EDIT_DRAWER, null) ?? create(liveMode());
