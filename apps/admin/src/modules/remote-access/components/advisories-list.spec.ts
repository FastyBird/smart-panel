import { ref } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { RemoteAccessModuleAdvisorySeverity } from '../../../openapi.constants';
import type { IRemoteAccessAdvisory } from '../store/remote-access-status.store.types';

import AdvisoriesList from './advisories-list.vue';

const advisories = ref<IRemoteAccessAdvisory[]>([]);

vi.mock('vue-i18n', () => ({
	// `StateView` and `StatusTag` come from the `common` barrel, which transitively imports
	// `src/locales/index.ts` - that module calls `createI18n(...)` at import time, so it has to
	// exist on the mock too, even though this spec only ever calls `useI18n()` itself. Mirrors
	// provider-cards.spec.ts (same directory, same full-mount shape).
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('../composables', () => ({
	useRemoteAccessStatus: () => ({ advisories }),
}));

describe('AdvisoriesList', () => {
	it('makes the HTTPS-disabled advisory console URL clickable without changing the message', async () => {
		const consoleUrl = 'https://login.tailscale.com/admin/dns';
		const message = `HTTPS Serve was requested, but this tailnet does not have HTTPS certificates enabled. Enable them at ${consoleUrl}.`;
		advisories.value = [
			{
				code: 'tailnet-https-disabled',
				severity: RemoteAccessModuleAdvisorySeverity.warning,
				message,
				provider: 'remote-access-tailscale-plugin',
			},
		];

		const wrapper = mount(AdvisoriesList);
		await flushPromises();

		const link = wrapper.find(`a[href="${consoleUrl}"]`);
		expect(link.exists()).toBe(true);
		expect(link.text()).toBe(consoleUrl);
		expect(link.attributes('target')).toBe('_blank');
		expect(link.attributes('rel')).toBe('noopener noreferrer');
		expect(wrapper.find('[data-test-id="advisory-message"]').text()).toBe(message);
		wrapper.unmount();
	});

	it('keeps other advisory messages as plain text', async () => {
		advisories.value = [
			{
				code: 'external-url-insecure',
				severity: RemoteAccessModuleAdvisorySeverity.warning,
				message: 'Check https://example.com and <a href="https://example.com">settings</a>.',
				provider: null,
			},
		];

		const wrapper = mount(AdvisoriesList);
		await flushPromises();

		expect(wrapper.find('[data-test-id="advisory-message"] a').exists()).toBe(false);
		expect(wrapper.text()).toContain(advisories.value[0].message);
		wrapper.unmount();
	});

	it('renders one row per advisory with the right severity status and "Module" for a null provider', async () => {
		advisories.value = [
			{ code: 'proxy-trust-untrusted', severity: RemoteAccessModuleAdvisorySeverity.critical, message: 'Forwarded headers ignored', provider: null },
			{
				code: 'funnel-open',
				severity: RemoteAccessModuleAdvisorySeverity.warning,
				message: 'Funnel is publishing to the internet',
				provider: 'remote-access-tailscale-plugin',
			},
			{
				code: 'no-https',
				severity: RemoteAccessModuleAdvisorySeverity.info,
				message: 'No HTTPS endpoint yet',
				provider: 'remote-access-tailscale-plugin',
			},
		];

		const wrapper = mount(AdvisoriesList);

		expect(wrapper.findAll('[data-test-id="advisory"]')).toHaveLength(advisories.value.length);

		await flushPromises();

		const tags = wrapper.findAllComponents({ name: 'StatusTag' });

		expect(tags.map((tag) => tag.props('status'))).toEqual(['critical', 'warn', 'info']);
		expect(tags.map((tag) => tag.props('label'))).toEqual([
			'remoteAccessModule.severity.critical',
			'remoteAccessModule.severity.warning',
			'remoteAccessModule.severity.info',
		]);

		expect(wrapper.text()).toContain('remoteAccessModule.texts.moduleSource');
		expect(wrapper.text()).toContain('remote-access-tailscale-plugin');
		expect(wrapper.text()).toContain('Forwarded headers ignored');
		expect(wrapper.text()).toContain('proxy-trust-untrusted');
	});

	it('renders the empty state when there are no advisories', () => {
		advisories.value = [];

		const wrapper = mount(AdvisoriesList);

		expect(wrapper.text()).toContain('remoteAccessModule.texts.noAdvisories');
	});
});
