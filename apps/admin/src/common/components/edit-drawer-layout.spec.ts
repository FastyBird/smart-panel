/* eslint-disable vue/one-component-per-file -- a host screen and the form it holds */
import { computed, defineComponent, h, onMounted, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';
import type { SizeClass } from '../composables/types';
import { provideEditDrawer } from '../composables/useEditDrawer';

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

	it.each<[SizeClass, SizeClass]>([
		['dt', 'wd'],
		['wd', 'dt'],
	])('keeps a changed form and its draft when the window goes from %s to %s while it is open', async (from, to) => {
		sizeClass.value = from;

		let mounts = 0;

		// A form with something typed in, held in its own state
		const Form = defineComponent({
			setup() {
				const name = ref('');

				onMounted(() => {
					mounts++;
				});

				return () =>
					h('input', {
						'data-test-id': 'name',
						value: name.value,
						onInput: (event: Event) => (name.value = (event.target as HTMLInputElement).value),
					});
			},
		});

		const open = ref(true);

		const wrapper = mount(
			defineComponent({
				setup() {
					provideEditDrawer(() => open.value);

					return () => h(EditDrawerLayout, { open: open.value }, { default: () => h('div'), form: () => h(Form) });
				},
			}),
			{
				global: {
					plugins: [i18n, router],
					stubs: { ElDrawer: { props: ['modelValue'], template: '<div data-test-id="drawer-stub"><slot v-if="modelValue" /></div>' } },
				},
			}
		);

		await wrapper.find('[data-test-id="name"]').setValue('Kitchen lamp');

		sizeClass.value = to;
		await wrapper.vm.$nextTick();

		expect(mounts).toBe(1);
		expect((wrapper.find('[data-test-id="name"]').element as HTMLInputElement).value).toBe('Kitchen lamp');

		sizeClass.value = from;
		await wrapper.vm.$nextTick();

		expect(mounts).toBe(1);
		expect((wrapper.find('[data-test-id="name"]').element as HTMLInputElement).value).toBe('Kitchen lamp');
	});
});
