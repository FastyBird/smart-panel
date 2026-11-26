import type { Ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';

import type { ISystemInfo } from '../store/system-info.store.types';
import type { IThrottleStatus } from '../store/throttle-status.store.types';

import ViewSystemInfo from './view-system-info.vue';

enableAutoUnmount(afterEach);

const mocks = vi.hoisted(() => ({
	systemInfo: null as unknown as Ref<ISystemInfo | null>,
	throttleStatus: null as unknown as Ref<IThrottleStatus | null>,
	fetchSystemInfo: vi.fn(),
	fetchThrottleStatus: vi.fn(),
	error: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key, locale: { value: 'en-US' } }),
}));

vi.mock('vue-meta', () => ({
	useMeta: vi.fn(),
}));

vi.mock('vue-router', async () => {
	const actual = await vi.importActual<typeof import('vue-router')>('vue-router');

	return { ...actual, useRouter: () => ({ push: vi.fn(), resolve: () => ({ href: '/' }) }) };
});

vi.mock('../../../common', async () => {
	const actual = await vi.importActual<typeof import('../../../common')>('../../../common');
	const { defineComponent: defineVueComponent } = await import('vue');

	return {
		...actual,
		AppBreadcrumbs: defineVueComponent({ name: 'AppBreadcrumbs', props: ['items'], setup: () => () => null }),
		ViewHeader: defineVueComponent({ name: 'ViewHeader', props: ['title', 'subtitle', 'icon', 'actions'], setup: () => () => null }),
		useFlashMessage: () => ({ success: vi.fn(), error: mocks.error, info: vi.fn() }),
	};
});

// The sections have their own specs; here they only show what the view hands them
vi.mock('../components/components', async () => {
	const { defineComponent: defineVueComponent, h } = await import('vue');

	const stub = (name: string, props: string[] = []) => defineVueComponent({ name, props, setup: () => () => h('div') });

	return {
		AboutApplication: stub('AboutApplication'),
		ManageSystem: stub('ManageSystem'),
		SystemHealthBanner: stub('SystemHealthBanner', ['throttleStatus']),
		SystemInfoDetail: stub('SystemInfoDetail', ['systemInfo', 'throttleStatus']),
		UpdateStatus: stub('UpdateStatus'),
	};
});

vi.mock('../composables/composables', async () => {
	const { ref } = await import('vue');

	mocks.systemInfo = ref(null);
	mocks.throttleStatus = ref(null);

	return {
		useSystemInfo: () => ({ systemInfo: mocks.systemInfo, isLoading: ref(false), fetchSystemInfo: mocks.fetchSystemInfo }),
		useThrottleStatus: () => ({ throttleStatus: mocks.throttleStatus, isLoading: ref(false), fetchThrottleStatus: mocks.fetchThrottleStatus }),
	};
});

const HEALTHY: IThrottleStatus = { undervoltage: false, frequencyCapping: false, throttling: false, softTempLimit: false };

describe('ViewSystemInfo', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.systemInfo.value = {} as ISystemInfo;
		mocks.throttleStatus.value = HEALTHY;
		mocks.fetchSystemInfo.mockResolvedValue(undefined);
		mocks.fetchThrottleStatus.mockResolvedValue(undefined);
	});

	it('hands the throttle reading to the banner and the sections', async () => {
		const wrapper = mount(ViewSystemInfo);
		await flushPromises();

		expect(wrapper.findComponent({ name: 'SystemHealthBanner' }).props('throttleStatus')).toEqual(HEALTHY);
		expect(wrapper.findComponent({ name: 'SystemInfoDetail' }).props('throttleStatus')).toEqual(HEALTHY);
	});

	it('does not pass off the previous reading as current when the throttle read fails', async () => {
		mocks.fetchThrottleStatus.mockRejectedValue(new Error('Bad request'));

		const wrapper = mount(ViewSystemInfo);
		await flushPromises();

		expect(wrapper.findComponent({ name: 'SystemHealthBanner' }).props('throttleStatus')).toBeNull();
		expect(wrapper.findComponent({ name: 'SystemInfoDetail' }).props('throttleStatus')).toBeNull();
	});

	it('shows an error with a retry when the system information cannot be read', async () => {
		mocks.systemInfo.value = null;
		mocks.fetchSystemInfo.mockRejectedValue(new Error('offline'));

		const wrapper = mount(ViewSystemInfo);
		await flushPromises();

		expect(wrapper.find('[data-test-id="system-info-error"]').exists()).toBe(true);

		mocks.fetchSystemInfo.mockResolvedValue(undefined);

		await wrapper.get('[data-test-id="system-info-error"] button').trigger('click');
		await flushPromises();

		expect(mocks.fetchSystemInfo).toHaveBeenCalledTimes(2);
	});
});
