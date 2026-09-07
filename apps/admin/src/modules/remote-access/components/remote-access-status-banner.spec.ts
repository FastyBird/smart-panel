import { ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import RemoteAccessStatusBanner from './remote-access-status-banner.vue';

const enabled = ref(true);
const advisories = ref<{ code: string; severity: string; message: string }[]>([]);
const hasExternalUrl = ref(true);

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
	};
});

vi.mock('../composables', () => ({
	useRemoteAccessStatus: () => ({ enabled, advisories, hasExternalUrl }),
}));

const mountBanner = () => shallowMount(RemoteAccessStatusBanner);

describe('RemoteAccessStatusBanner', () => {
	beforeEach(() => {
		enabled.value = true;
		advisories.value = [];
		hasExternalUrl.value = true;
	});

	it('shows an info banner when the module is disabled', () => {
		enabled.value = false;

		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('type')).toBe('info');
		expect(alert.props('title')).toBe('remoteAccessModule.status.banner.disabledTitle');
		expect(alert.props('description')).toBe('remoteAccessModule.status.banner.disabledDescription');
	});

	it('shows an info banner when enabled but no external URL is available yet', () => {
		enabled.value = true;
		hasExternalUrl.value = false;

		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('type')).toBe('info');
		expect(alert.props('title')).toBe('remoteAccessModule.status.banner.noExternalUrlTitle');
		expect(alert.props('description')).toBe('remoteAccessModule.status.banner.noExternalUrlDescription');
	});

	it('shows an error banner when a critical advisory is present', () => {
		advisories.value = [{ code: 'external-url-insecure', severity: 'critical', message: 'HTTP is insecure.' }];

		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('type')).toBe('error');
		expect(alert.props('title')).toBe('remoteAccessModule.status.banner.advisoriesTitle:{"count":1}');
	});

	it('shows a warning banner when only warning-severity advisories are present', () => {
		advisories.value = [{ code: 'key-expiring', severity: 'warning', message: 'The node key expires soon.' }];

		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('type')).toBe('warning');
	});

	it('shows a success banner when enabled, reachable and free of advisories', () => {
		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('type')).toBe('success');
		expect(alert.props('title')).toBe('remoteAccessModule.status.banner.okTitle');
		expect(alert.props('description')).toBe('remoteAccessModule.status.banner.okDescription');
	});

	it('prioritises the no-external-url case over an advisory', () => {
		hasExternalUrl.value = false;
		advisories.value = [{ code: 'key-expiring', severity: 'critical', message: 'x' }];

		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('type')).toBe('info');
		expect(alert.props('title')).toBe('remoteAccessModule.status.banner.noExternalUrlTitle');
	});

	it('prioritises the disabled case over everything else', () => {
		enabled.value = false;
		hasExternalUrl.value = false;
		advisories.value = [{ code: 'key-expiring', severity: 'critical', message: 'x' }];

		const wrapper = mountBanner();
		const alert = wrapper.findComponent({ name: 'ElAlert' });

		expect(alert.props('title')).toBe('remoteAccessModule.status.banner.disabledTitle');
	});
});
