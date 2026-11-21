import { computed, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';
import type { SizeClass } from '../composables/types';

import type { EditDrawerLayoutProps } from './edit-drawer-layout.types';
import EditDrawerLayout from './edit-drawer-layout.vue';

const sizeClass = ref<SizeClass>('dt');

vi.mock('../composables/useSizeClass', () => ({
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
		isTouch: computed(() => false),
	}),
}));

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });

const render = (props: EditDrawerLayoutProps) =>
	mount(EditDrawerLayout, {
		props,
		slots: { default: '<div data-test-id="list" />', form: '<div data-test-id="form" />' },
		global: {
			plugins: [i18n, router],
			stubs: {
				ElDrawer: {
					name: 'ElDrawer',
					props: ['modelValue', 'size', 'beforeClose'],
					template: '<div data-test-id="drawer-stub" :data-size="size"><slot v-if="modelValue" /></div>',
				},
			},
		},
	});

describe('EditDrawerLayout.vue', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it('opens the form in a 640 px drawer over the list on desktop and tablet landscape', () => {
		for (const size of ['dt', 'tl'] as SizeClass[]) {
			sizeClass.value = size;

			const wrapper = render({ open: true });

			expect(wrapper.find('[data-test-id="list"]').exists()).toBe(true);
			expect(wrapper.find('[data-test-id="edit-drawer"]').attributes('data-size')).toBe('640px');
			expect(wrapper.find('[data-test-id="edit-drawer"] [data-test-id="form"]').exists()).toBe(true);
			expect(wrapper.find('[data-test-id="edit-drawer-docked"]').exists()).toBe(false);
		}
	});

	it('opens a full-width drawer on tablet portrait', () => {
		sizeClass.value = 'tp';

		expect(render({ open: true }).find('[data-test-id="edit-drawer"]').attributes('data-size')).toBe('100%');
	});

	it('docks the form beside the list on wide, without a drawer', () => {
		sizeClass.value = 'wd';

		const wrapper = render({ open: true });

		expect(wrapper.find('[data-test-id="edit-drawer"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="edit-drawer-docked"] [data-test-id="form"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="edit-drawer-docked"]').attributes('style')).toContain('width: 640px');
	});

	it('renders only the list on phone, where the form is its own route', () => {
		sizeClass.value = 'phone';

		const wrapper = render({ open: true });

		expect(wrapper.find('[data-test-id="list"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="form"]').exists()).toBe(false);
	});

	it('shows no form while closed', () => {
		sizeClass.value = 'wd';

		expect(render({ open: false }).find('[data-test-id="form"]').exists()).toBe(false);
	});

	it('closes from the bar of the docked form', async () => {
		sizeClass.value = 'wd';

		const wrapper = render({ open: true });

		await wrapper.find('[data-test-id="app-bar-scope-close"]').trigger('click');

		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('hands Escape and the scrim to the unsaved-changes guard', () => {
		const beforeClose = vi.fn();
		const wrapper = render({ open: true, beforeClose });
		const done = vi.fn();

		(wrapper.findComponent({ name: 'ElDrawer' }).props('beforeClose') as (done: () => void) => void)(done);

		expect(beforeClose).toHaveBeenCalledWith(done);
	});
});
