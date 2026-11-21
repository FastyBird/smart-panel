/* eslint-disable vue/one-component-per-file -- a page and a nested screen that both show breadcrumbs */
import { defineComponent, h, ref } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import enUS from '../../locales/en-US.json';

import AppBreadcrumbs from './app-breadcrumbs.vue';
import { BREADCRUMBS_TARGET } from './app-top-bar.types';

vi.mock('../composables/useBreakpoints', async () => {
	const { computed } = await import('vue');

	return { useBreakpoints: () => ({ isMDDevice: computed(() => true) }) };
});

const i18n = createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } });
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });

const trail = (label: string) => [{ label, route: router.resolve('/') }];

describe('AppBreadcrumbs.vue', () => {
	let target: HTMLElement;

	afterEach(() => {
		target?.remove();
	});

	it('shows only the innermost screen while it is open, then its parent again', async () => {
		target = document.createElement('div');
		target.id = BREADCRUMBS_TARGET;
		document.body.appendChild(target);

		const showChild = ref(true);

		// A list with its form docked beside it: both mount together, the form's trail must win
		const Page = defineComponent({
			setup: () => () => [
				h(AppBreadcrumbs, { items: trail('Devices') }),
				showChild.value ? h(defineComponent({ setup: () => () => h(AppBreadcrumbs, { items: trail('Edit device') }) })) : null,
			],
		});

		const wrapper = mount(Page, { global: { plugins: [i18n, router] }, attachTo: document.body });

		await flushPromises();

		expect(target.textContent).toContain('Edit device');
		expect(target.textContent).not.toContain('Devices');

		showChild.value = false;

		await flushPromises();

		expect(target.textContent).toContain('Devices');

		wrapper.unmount();
	});
});
