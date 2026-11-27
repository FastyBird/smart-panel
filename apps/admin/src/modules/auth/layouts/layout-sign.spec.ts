import { createRouter, createWebHistory } from 'vue-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { StandaloneLayout } from '../../../common';
import { RouteNames } from '../auth.constants';

import LayoutSign from './layout-sign.vue';

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

describe('LayoutSign', (): void => {
	let wrapper: VueWrapper;
	let router: ReturnType<typeof createRouter>;

	beforeEach((): void => {
		router = createRouter({
			history: createWebHistory(),
			routes: [
				{ path: '/', name: AppRouteNames.ROOT, component: { template: '<div>Root</div>' } },
				{ path: '/sign-in', name: RouteNames.SIGN_IN, component: { template: '<div>Sign In</div>' } },
				{ path: '/sign-up', name: RouteNames.SIGN_UP, component: { template: '<div>Sign Up</div>' } },
			],
		});

		wrapper = mount(LayoutSign, {
			global: {
				plugins: [router],
			},
		});
	});

	it('sits on the standalone card, its brand mark leading to sign in', async (): Promise<void> => {
		await router.push({ name: RouteNames.SIGN_IN });

		const layout = wrapper.findComponent(StandaloneLayout);

		expect(layout.exists()).toBe(true);
		expect(layout.props('logoTo')).toEqual({ name: RouteNames.SIGN_IN });
		expect(layout.props('logoLabel')).toBe('authModule.buttons.goToSignIn.title');
	});

	it('titles the sign-in page', async (): Promise<void> => {
		await router.push({ name: RouteNames.SIGN_IN });

		expect(wrapper.find('h1').text()).toBe('authModule.headings.signIn');
		expect(wrapper.findComponent(StandaloneLayout).props('subtitle')).toBe('authModule.subHeadings.signIn');
	});

	it('titles the sign-up page', async (): Promise<void> => {
		await router.push({ name: RouteNames.SIGN_UP });

		expect(wrapper.find('h1').text()).toBe('authModule.headings.signUp');
		expect(wrapper.findComponent(StandaloneLayout).props('subtitle')).toBe('authModule.subHeadings.signUp');
	});

	it('keeps the project links and the copyright', (): void => {
		expect(wrapper.findAll('[data-test-id="standalone-layout-links"] nav a')).toHaveLength(4);
		expect(wrapper.find('[data-test-id="author-link"]').attributes('href')).toBe('https://smart-panel.fastybird.com');
	});
});
