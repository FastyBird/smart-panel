import type { ComponentPublicInstance } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import AboutApplication from './about-application.vue';

type AboutApplicationInstance = ComponentPublicInstance;

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string, params?: Record<string, string>) => (params?.version ? `Version ${params.version}` : key),
	}),
}));

describe('AboutApplication', () => {
	let wrapper: VueWrapper<AboutApplicationInstance>;

	beforeEach(() => {
		wrapper = mount(AboutApplication);
	});

	it('renders application name and version', () => {
		expect(wrapper.text()).toContain('FastyBird! Smart Panel');
		expect(wrapper.text()).toMatch(/Version \d+\.\d+\.\d+/);
	});

	it('renders the translated about text', () => {
		expect(wrapper.find('[data-test-id="about-info"]').text()).toContain('systemModule.texts.system.about');
	});

	it('renders social media links, each opening in a new tab', () => {
		const links = wrapper.findAll('a');

		expect(links).toHaveLength(4);
		expect(links.every((link) => link.attributes('target') === '_blank' && link.attributes('rel') === 'noopener noreferrer')).toBe(true);

		expect(links[0]?.attributes('href')).toBe('https://github.com/fastybird');
		expect(links[1]?.attributes('href')).toBe('https://x.com/fastybird');
		expect(links[2]?.attributes('href')).toBe('https://discord.gg/HPRJ2GzK');
		expect(links[3]?.attributes('href')).toBe('https://www.facebook.com/fastybird');
	});
});
