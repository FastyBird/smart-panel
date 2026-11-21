import { computed, ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import type { SizeClass } from './types';
import { useEditDrawer } from './useEditDrawer';

const sizeClass = ref<SizeClass>('dt');

vi.mock('./useSizeClass', () => ({
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed(() => false),
	}),
}));

describe('useEditDrawer', () => {
	it.each<[SizeClass, string, boolean, string]>([
		['phone', 'page', false, '640px'],
		['tp', 'drawer', true, '100%'],
		['tl', 'drawer', true, '640px'],
		['dt', 'drawer', true, '640px'],
		['wd', 'docked', true, '640px'],
	])('opens the form as a %s → %s', (size, mode, inDrawer, drawerSize) => {
		sizeClass.value = size;

		const editDrawer = useEditDrawer();

		expect(editDrawer.mode.value).toBe(mode);
		expect(editDrawer.inDrawer.value).toBe(inDrawer);
		expect(editDrawer.drawerSize.value).toBe(drawerSize);
	});
});
