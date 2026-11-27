import { createI18n } from 'vue-i18n';
import { createMemoryHistory, createRouter } from 'vue-router';

import { describe, expect, it } from 'vitest';

import { mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import type { StandaloneLayoutProps } from './standalone-layout.types';
import StandaloneLayout from './standalone-layout.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const router = createRouter({
	history: createMemoryHistory(),
	routes: [{ path: '/', name: 'home', component: { template: '<div />' } }],
});

const render = (props: StandaloneLayoutProps) =>
	mount(StandaloneLayout, { props, slots: { default: '<p data-test-id="body">Body</p>' }, global: { plugins: [i18n, router] } });

describe('StandaloneLayout.vue', () => {
	it('names the card by its title and shows the subtitle and the body', () => {
		const wrapper = render({ title: 'Sign in', subtitle: 'Manage your Smart Panel' });

		const title = wrapper.find('h1');

		expect(title.text()).toBe('Sign in');
		expect(wrapper.find('section').attributes('aria-labelledby')).toBe(title.attributes('id'));
		expect(wrapper.find('[data-test-id="standalone-layout-subtitle"]').text()).toBe('Manage your Smart Panel');
		expect(wrapper.find('[data-test-id="body"]').exists()).toBe(true);
	});

	it('leaves the subtitle out when there is none', () => {
		expect(render({ title: 'Powered off' }).find('[data-test-id="standalone-layout-subtitle"]').exists()).toBe(false);
	});

	it('makes the brand mark a named link only when it leads somewhere', () => {
		const plain = render({ title: 'Screen locked' });

		expect(plain.find('a[data-test-id="standalone-layout-logo"]').exists()).toBe(false);

		const linked = render({ title: 'Sign in', logoTo: { name: 'home' }, logoLabel: 'Go to sign in' });
		const link = linked.find('a[data-test-id="standalone-layout-logo"]');

		expect(link.exists()).toBe(true);
		expect(link.attributes('aria-label')).toBe('Go to sign in');
	});

	it('shows the project links and the copyright, each named and opening apart', () => {
		const footer = render({ title: 'Sign in' }).find('[data-test-id="standalone-layout-links"]');

		const links = footer.findAll('nav a');

		expect(links.map((link) => link.attributes('aria-label'))).toEqual(['GitHub', 'X', 'Discord', 'Facebook']);
		expect(links.every((link) => link.attributes('rel') === 'noopener noreferrer')).toBe(true);
		expect(footer.text()).toContain('©');
		expect(footer.find('[data-test-id="author-link"]').attributes('href')).toBe('https://smart-panel.fastybird.com');
	});

	it('can leave the links out', () => {
		expect(render({ title: 'Sign in', links: false }).find('[data-test-id="standalone-layout-links"]').exists()).toBe(false);
	});
});
