/* eslint-disable vue/one-component-per-file -- a host screen and the form it holds */
import { computed, defineComponent, h, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { SizeClass } from './types';
import { type IUseEditDrawer, provideEditDrawer, useEditDrawer } from './useEditDrawer';

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
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it.each<[SizeClass, string, boolean, string]>([
		['phone', 'page', false, '100%'],
		['tp', 'drawer', true, '100%'],
		['tl', 'drawer', true, '640px'],
		['dt', 'drawer', true, '640px'],
		['wd', 'docked', true, '640px'],
	])('opens the form on %s as %s', (size, mode, inDrawer, drawerSize) => {
		sizeClass.value = size;

		const editDrawer = useEditDrawer();

		expect(editDrawer.mode.value).toBe(mode);
		expect(editDrawer.inDrawer.value).toBe(inDrawer);
		expect(editDrawer.drawerSize.value).toBe(drawerSize);
	});

	it('keeps the mode a form opened in until it closes, and gives the form the same value', () => {
		const open = ref(false);
		let host: IUseEditDrawer | null = null;
		let form: IUseEditDrawer | null = null;

		const Form = defineComponent({
			setup() {
				form = useEditDrawer();

				return () => h('div');
			},
		});

		mount(
			defineComponent({
				setup() {
					host = provideEditDrawer(() => open.value);

					return () => h(Form);
				},
			})
		);

		sizeClass.value = 'phone';
		open.value = true;

		// A phone turned to landscape: the open form stays a page
		sizeClass.value = 'tp';

		expect(host!.mode.value).toBe('page');
		expect(form!.mode.value).toBe('page');

		// Closed, the screen follows the window again
		open.value = false;

		expect(host!.mode.value).toBe('drawer');

		// Opened on desktop, widening to wide keeps the drawer instead of docking it
		sizeClass.value = 'dt';
		open.value = true;
		sizeClass.value = 'wd';

		expect(form!.mode.value).toBe('drawer');

		// Opened docked on wide, narrowing to desktop keeps it docked
		open.value = false;
		open.value = true;
		sizeClass.value = 'dt';

		expect(form!.mode.value).toBe('docked');

		// And a drawer opened on tablet stays one when the window shrinks to phone
		open.value = false;
		sizeClass.value = 'tp';
		open.value = true;
		sizeClass.value = 'phone';

		expect(host!.mode.value).toBe('drawer');
	});
});
