import { computed } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHistory } from 'vue-router';

import { ElCard, ElIcon, ElLink } from 'element-plus';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { VueWrapper, mount } from '@vue/test-utils';

import { RouteNames as AppRouteNames } from '../../../app.constants';
import { type IUseBreakpoints, useBreakpoints } from '../../../common';
import { RouteNames } from '../auth.constants';
import enUS from '../locales/en-US.json';

import LayoutSign from './layout-sign.vue';

const isMDDevice = computed(() => true);

vi.mock('../../../common', () => ({
	useBreakpoints: vi.fn(() => ({
		isMDDevice: isMDDevice,
	})),
}));

describe('LayoutSign', (): void => {
	let wrapper: VueWrapper;
	let router;

	beforeEach((): void => {
		vi.clearAllMocks();

		const i18n = createI18n({
			locale: 'en',
			messages: {
				en: {
					authModule: enUS,
				},
			},
		});

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
				plugins: [i18n, router],
			},
		});
	});

	it('renders the component correctly', async (): Promise<void> => {
		expect(wrapper.exists()).toBe(true);
	});

	it('displays the sign-in heading when on the sign-in page', async (): Promise<void> => {
		await router.push({ name: RouteNames.SIGN_IN });

		expect(wrapper.find('[data-test-id="sign-heading"]').text()).toContain('Sign in');
	});

	it('displays the sign-up heading when on the sign-up page', async (): Promise<void> => {
		await router.push({ name: RouteNames.SIGN_UP });

		expect(wrapper.find('[data-test-id="sign-heading"]').text()).toContain('Sign up');
	});

	it('should show social media links with correct icons', (): void => {
		const block = wrapper.find('[data-test-id="social-links"]');

		expect(block.exists()).toBe(true);

		const socialLinks = block.findAllComponents(ElLink);

		expect(socialLinks).toHaveLength(4);

		const icons = block.findAllComponents(ElIcon);

		expect(icons).toHaveLength(4);
	});

	it('should conditionally render ElCard when isMDDevice is true', (): void => {
		vi.mocked(useBreakpoints).mockReturnValue({ isMDDevice: computed<boolean>(() => true) } as IUseBreakpoints);

		expect(wrapper.findComponent(ElCard).exists()).toBe(true);
	});

	it('should display copyright information', (): void => {
		expect(wrapper.text()).toContain('©');
		expect(wrapper.find('[data-test-id="author-link"]').attributes('href')).toBe('https://www.fastybird.com');
	});
});
