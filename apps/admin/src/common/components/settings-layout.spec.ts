import { computed, h, ref } from 'vue';
import { createI18n } from 'vue-i18n';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';
import type { SizeClass } from '../composables/types';

import type { SettingsLayoutSection } from './settings-layout.types';
import SettingsLayout from './settings-layout.vue';
import SettingsSection from './settings-section.vue';

enableAutoUnmount(afterEach);

const sizeClass = ref<SizeClass>('dt');

vi.mock('../composables/useSizeClass', () => ({
	useSizeClass: () => ({
		sizeClass,
		isPhone: computed(() => sizeClass.value === 'phone'),
		isTabletPortrait: computed(() => sizeClass.value === 'tp'),
		isTabletLandscape: computed(() => sizeClass.value === 'tl'),
		isDesktop: computed(() => sizeClass.value === 'dt' || sizeClass.value === 'wd'),
	}),
}));

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const sections: SettingsLayoutSection[] = [
	{ id: 'urls', label: 'Access URLs', icon: 'mdi:link-variant' },
	{ id: 'providers', label: 'Providers' },
	{ id: 'advisories', label: 'Advisories', count: 3 },
];

const render = () =>
	mount(SettingsLayout, {
		props: { sections },
		slots: {
			banner: () => h('div', { 'data-test-id': 'banner' }, 'Healthy'),
			default: () => sections.map((section) => h(SettingsSection, { id: section.id, title: section.label }, () => section.label)),
		},
		attachTo: document.body,
		global: { plugins: [i18n] },
	});

// Places each section card `top` px below the top of the scroller
const placeSections = (wrapper: ReturnType<typeof render>, tops: Record<string, number>): void => {
	vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect);

	for (const [id, top] of Object.entries(tops)) {
		vi.spyOn(wrapper.find(`#${id}`).element, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect);
	}
};

describe('SettingsLayout', () => {
	beforeEach(() => {
		sizeClass.value = 'dt';
	});

	it('shows the banner above the sections, and an anchor nav with one link per section from desktop', () => {
		const wrapper = render();

		expect(wrapper.find('[data-test-id="banner"]').exists()).toBe(true);

		const links = wrapper.findAll('[data-test-id="settings-layout-link"]');

		expect(links.map((link) => link.attributes('href'))).toEqual(['#urls', '#providers', '#advisories']);
		expect(links[2].text()).toContain('3');
		expect(wrapper.findAll('[data-test-id="settings-section"]')).toHaveLength(3);
	});

	it.each(['tl', 'tp', 'phone'] as const)('stacks the cards without the nav on %s', (size) => {
		sizeClass.value = size;

		const wrapper = render();

		expect(wrapper.find('[data-test-id="settings-layout-nav"]').exists()).toBe(false);
		expect(wrapper.findAll('[data-test-id="settings-section"]')).toHaveLength(3);
	});

	it('scrolls to the section a link names and marks it', async () => {
		const wrapper = render();
		const scrollIntoView = vi.fn();

		await flushPromises();

		(wrapper.find('#providers').element as HTMLElement).scrollIntoView = scrollIntoView;

		await wrapper.find('[data-section-id="providers"]').trigger('click');

		expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
		expect(wrapper.find('[data-section-id="providers"]').attributes('aria-current')).toBe('location');
	});

	it('follows the section being read as the page scrolls', async () => {
		const wrapper = render();
		const scroller = wrapper.element as HTMLElement;

		await flushPromises();

		Object.defineProperty(scroller, 'clientHeight', { value: 600, configurable: true });
		Object.defineProperty(scroller, 'scrollHeight', { value: 2000, configurable: true });

		placeSections(wrapper, { urls: -400, providers: 40, advisories: 700 });
		scroller.scrollTop = 400;

		await wrapper.trigger('scroll');

		expect(wrapper.find('[data-section-id="providers"]').attributes('aria-current')).toBe('location');

		// At the bottom the last section counts as read, however short it is
		scroller.scrollTop = 1400;

		await wrapper.trigger('scroll');

		expect(wrapper.find('[data-section-id="advisories"]').attributes('aria-current')).toBe('location');
	});
});
