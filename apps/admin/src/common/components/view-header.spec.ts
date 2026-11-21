/* eslint-disable vue/one-component-per-file -- host components that provide the app bar to the header */
import { computed, defineComponent, h, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';
import type { SizeClass } from '../composables/types';
import { type AppBarHostKind, type IAppBarHeading, type IAppBarHost, provideAppBarHost } from '../composables/useAppBarHost';

import type { ViewHeaderProps } from './view-header.types';
import ViewHeader from './view-header.vue';

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

const router = createRouter({
	history: createWebHistory(),
	routes: [
		{ path: '/', name: 'root', component: { template: '<div />' } },
		{ path: '/devices', name: 'devices', component: { template: '<div />' } },
	],
});

// Mounts the header under an app bar host that is active on phone only, as the layout's is
const render = (
	props: ViewHeaderProps,
	slots: Record<string, string> = {},
	active: () => boolean = () => sizeClass.value === 'phone',
	kind: AppBarHostKind = 'layout'
) => {
	let host: IAppBarHost | null = null;

	const Host = defineComponent({
		setup() {
			host = provideAppBarHost(active, kind);

			return () => h(ViewHeader, props, Object.fromEntries(Object.entries(slots).map(([name, html]) => [name, () => h('div', { innerHTML: html })])));
		},
	});

	const wrapper = mount(Host, { global: { plugins: [i18n, router] } });

	return { wrapper, heading: (): IAppBarHeading | null => host!.heading.value };
};

describe('ViewHeader.vue', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it('renders the page header with the icon, title and subtitle above phone width', () => {
		const { wrapper } = render({ title: 'Devices', subtitle: '48 devices', icon: 'mdi:devices' });

		expect(wrapper.find('[data-test-id="view-header"] h1').text()).toBe('Devices');
		expect(wrapper.find('h1').classes()).toContain('text-title');
		expect(wrapper.text()).toContain('48 devices');
		expect(wrapper.find('[data-test-id="view-header-icon"]').exists()).toBe(true);
	});

	it('renders the actions and the tags', () => {
		const { wrapper } = render({ title: 'Devices' }, { actions: '<button data-test-id="add">Add</button>', tags: '<span data-test-id="tag" />' });

		expect(wrapper.find('[data-test-id="view-header-actions"] [data-test-id="add"]').exists()).toBe(true);
		expect(wrapper.find('[data-test-id="tag"]').exists()).toBe(true);
	});

	it('links the back arrow to the back route', () => {
		const { wrapper } = render({ title: 'Living room lamp', back: { name: 'devices' } });

		const back = wrapper.find('[data-test-id="view-header-back"]');

		expect(back.attributes('href')).toBe('/devices');
		expect(back.attributes('aria-label')).toBe('Back');
	});

	it('lets a handler take back or close instead, as a close button when asked', async () => {
		const onBack = vi.fn();
		const { wrapper } = render({ title: 'Edit device', left: 'close', onBack });

		const back = wrapper.find('[data-test-id="view-header-back"]');

		expect(back.element.tagName).toBe('BUTTON');
		expect(back.attributes('aria-label')).toBe('Close');

		await back.trigger('click');

		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('has no back arrow on a top-level screen', () => {
		expect(render({ title: 'Devices' }).wrapper.find('[data-test-id="view-header-back"]').exists()).toBe(false);
	});

	it('draws into the app bar on phone instead of rendering the page header', async () => {
		sizeClass.value = 'phone';

		const onBack = vi.fn();
		const handler = vi.fn();
		const { wrapper, heading } = render({
			title: 'Edit device',
			subtitle: 'Living room lamp',
			left: 'close',
			onBack,
			backDisabled: true,
			primary: { label: 'Save', handler },
		});

		await flushPromises();

		expect(wrapper.find('[data-test-id="view-header"]').exists()).toBe(false);
		expect(heading()).toMatchObject({
			title: 'Edit device',
			subtitle: 'Living room lamp',
			left: 'close',
			leftDisabled: true,
			primary: { label: 'Save' },
		});

		heading()!.onLeft!();

		expect(onBack).toHaveBeenCalledTimes(1);
	});

	it('gives the phone bar the menu on a top-level screen and back where there is somewhere to go', async () => {
		sizeClass.value = 'phone';

		const top = render({ title: 'Devices', actions: [{ icon: 'mdi:plus', label: 'Add device', handler: vi.fn() }] });
		const detail = render({ title: 'Living room lamp', back: { name: 'devices' } });

		await flushPromises();

		expect(top.heading()).toMatchObject({ left: 'menu', actions: [{ label: 'Add device' }] });
		expect(detail.heading()?.left).toBe('back');

		const push = vi.spyOn(router, 'push');

		detail.heading()!.onLeft!();

		expect(push).toHaveBeenCalledWith({ name: 'devices' });
	});

	it.each<SizeClass>(['phone', 'dt'])('hands a drawer bar only its title at %s width, as the drawer has its own close and footer', async (size) => {
		sizeClass.value = size;

		const { wrapper, heading } = render(
			{ title: 'Filters', subtitle: 'Narrow the list', primary: { label: 'Save', handler: vi.fn() }, onBack: vi.fn() },
			{ actions: '<button data-test-id="apply">Apply</button>' },
			() => true,
			'drawer'
		);

		await flushPromises();

		expect(wrapper.find('[data-test-id="view-header"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="view-header-actions"]').exists()).toBe(false);
		expect(heading()).toMatchObject({ title: 'Filters', subtitle: 'Narrow the list', left: null, actions: [], primary: undefined });
	});

	it('keeps the actions slot as a row under the phone bar when it hands the bar no actions', async () => {
		sizeClass.value = 'phone';

		const { wrapper } = render({ title: 'Displays' }, { actions: '<button data-test-id="permit-join">Permit join</button>' });

		await flushPromises();

		expect(wrapper.find('[data-test-id="view-header"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="view-header-actions"] [data-test-id="permit-join"]').exists()).toBe(true);
	});

	it('leaves the actions slot to larger screens when the phone bar has actions of its own', async () => {
		sizeClass.value = 'phone';

		const { wrapper } = render(
			{ title: 'Devices', actions: [{ icon: 'mdi:plus', label: 'Add device', handler: vi.fn() }] },
			{ actions: '<button data-test-id="add">Add device</button>' }
		);

		await flushPromises();

		expect(wrapper.find('[data-test-id="view-header-actions"]').exists()).toBe(false);
	});

	it('follows changes to its title in the app bar', async () => {
		sizeClass.value = 'phone';

		const title = ref('Loading');
		let host: IAppBarHost | null = null;

		const Host = defineComponent({
			setup() {
				host = provideAppBarHost(() => true);

				return () => h(ViewHeader, { title: title.value });
			},
		});

		mount(Host, { global: { plugins: [i18n, router] } });

		await flushPromises();

		title.value = 'Living room lamp';

		await flushPromises();

		expect(host!.heading.value?.title).toBe('Living room lamp');
	});

	it('leaves the app bar when it unmounts, showing the header below it again', async () => {
		sizeClass.value = 'phone';

		const showChild = ref(true);
		let host: IAppBarHost | null = null;

		const Host = defineComponent({
			setup() {
				host = provideAppBarHost(() => true);

				return () => [h(ViewHeader, { title: 'Devices' }), showChild.value ? h(ViewHeader, { title: 'Living room lamp' }) : null];
			},
		});

		mount(Host, { global: { plugins: [i18n, router] } });

		await flushPromises();

		expect(host!.heading.value?.title).toBe('Living room lamp');

		showChild.value = false;

		await flushPromises();

		expect(host!.heading.value?.title).toBe('Devices');
	});

	it('renders the page header when nothing hosts an app bar', () => {
		sizeClass.value = 'phone';

		const wrapper = mount(ViewHeader, { props: { title: 'Sign in' }, global: { plugins: [i18n, router] } });

		expect(wrapper.find('h1').text()).toBe('Sign in');
	});
});
