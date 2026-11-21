import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { describe, expect, it } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import AppBarScope from './app-bar-scope.vue';
import ViewHeader from './view-header.vue';

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });

const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });

const render = (props: Record<string, unknown> = {}) =>
	mount(
		{
			components: { AppBarScope, ViewHeader },
			setup: () => ({ props }),
			template:
				'<app-bar-scope v-bind="props" @close="$emit(\'close\')"><view-header title="Edit device" subtitle="Living room lamp" /><p data-test-id="body">Form</p></app-bar-scope>',
			emits: ['close'],
		},
		{ global: { plugins: [i18n, router] } }
	);

describe('AppBarScope.vue', () => {
	it('draws the header of the screen inside it into its own app bar', async () => {
		const wrapper = render();

		await flushPromises();

		expect(wrapper.find('[data-test-id="app-bar"] h1').text()).toBe('Edit device');
		expect(wrapper.find('[data-test-id="app-bar"]').text()).toContain('Living room lamp');
		expect(wrapper.find('[data-test-id="view-header"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="body"]').exists()).toBe(true);
	});

	it('closes through its Close button', async () => {
		const wrapper = render();

		const close = wrapper.find('[data-test-id="app-bar-scope-close"]');

		expect(close.attributes('aria-label')).toBe('Close');

		await close.trigger('click');

		expect(wrapper.emitted('close')).toHaveLength(1);
	});

	it('can leave the Close button out', () => {
		expect(render({ closable: false }).find('[data-test-id="app-bar-scope-close"]').exists()).toBe(false);
	});
});
