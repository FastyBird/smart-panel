import type { ComponentPublicInstance } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import AboutApplication from './about-application.vue';

type AboutApplicationInstance = ComponentPublicInstance;

vi.mock('vue-i18n', () => ({
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('AboutApplication', () => {
	let wrapper: VueWrapper<AboutApplicationInstance>;

	beforeEach(() => {
		wrapper = mount(AboutApplication);
	});

	it('renders application name and version', () => {
		expect(wrapper.text()).toContain('FastyBird! Smart Panel');
		expect(wrapper.text()).toContain('Version 1.0.0');
	});

	it('renders the translated about text', () => {
		expect(wrapper.find('[data-test-id="about-info"]').text()).toContain('systemModule.texts.system.about');
	});

	it('renders social media links', () => {
		const links = wrapper.findAllComponents({ name: 'ElLink' });

		expect(links).toHaveLength(4);

		expect(links[0]?.attributes('href')).toBe('http://www.github.com/fastybird');
		expect(links[1]?.attributes('href')).toBe('http://www.x.com/fastybird');
		expect(links[2]?.attributes('href')).toBe('http://www.facebook.com/fastybird');
		expect(links[3]?.attributes('href')).toBe('http://www.facebook.com/fastybird');
	});
});
