import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import { DevicesUnifiProtectPluginErrorCategory, DevicesUnifiProtectPluginTlsMode } from '../../../openapi.constants';
import type { IProtectTestConnection } from '../store/protect.types';

import ProtectTestConnection from './protect-test-connection.vue';

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			locale: 'en-US',
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
			te: (key: string) => !key.endsWith('.some_future_category'),
		}),
	};
});

const FINGERPRINT = 'cd'.repeat(32);

const passed = (overrides: Partial<IProtectTestConnection> = {}): IProtectTestConnection => ({
	mode: 'saved',
	success: true,
	tlsMode: DevicesUnifiProtectPluginTlsMode.verify,
	certificate: null,
	directConnectDomain: null,
	suggestedServerName: null,
	consoleName: 'Dream Machine',
	consoleModel: 'UDM-Pro',
	applicationVersion: '9.1.0',
	minimumVersion: '9.0.42',
	versionSupported: true,
	nvrName: 'Home NVR',
	errorCategory: null,
	error: null,
	...overrides,
});

const mountTest = (props: Record<string, unknown> = {}) =>
	mount(ProtectTestConnection, {
		props: { result: null, ...props },
	});

describe('ProtectTestConnection', () => {
	it('shows the minimum version from the API', () => {
		const wrapper = mountTest({ result: passed() });

		const success = wrapper.get('[data-test-id="protect-test-success"]');

		expect(success.text()).toContain('Dream Machine');
		expect(success.text()).toContain('UDM-Pro');
		expect(success.text()).toContain('9.1.0');
		expect(success.text()).toContain('Home NVR');
		expect(wrapper.get('[data-test-id="protect-test-minimum-version"]').text()).toContain('9.0.42');
		expect(wrapper.get('[data-test-id="protect-test-version-supported"]').text()).toContain(
			'devicesUnifiProtectPlugin.testConnection.version.supported'
		);
		expect(wrapper.find('[data-test-id="protect-test-failure"]').exists()).toBe(false);
	});

	it('shows a failed test with its category sentence first and the backend message second', () => {
		const wrapper = mountTest({
			result: passed({
				success: false,
				applicationVersion: '6.0.0',
				versionSupported: false,
				nvrName: null,
				errorCategory: DevicesUnifiProtectPluginErrorCategory.version_unsupported,
				error: 'UniFi Protect version is not supported.',
			}),
		});

		const failure = wrapper.get('[data-test-id="protect-test-failure"]');

		expect(failure.text()).toContain('devicesUnifiProtectPlugin.errorCategories.version_unsupported');
		expect(failure.text()).toContain('9.0.42');
		expect(wrapper.get('[data-test-id="protect-test-failure-detail"]').text()).toBe('UniFi Protect version is not supported.');
		expect(wrapper.get('[data-test-id="protect-test-version-supported"]').text()).toContain(
			'devicesUnifiProtectPlugin.testConnection.version.unsupported'
		);
		expect(wrapper.find('[data-test-id="protect-test-success"]').exists()).toBe(false);
	});

	it('falls back to the generic failure sentence for a category it has no sentence for', () => {
		const wrapper = mountTest({
			result: passed({
				success: false,
				errorCategory: 'some_future_category' as DevicesUnifiProtectPluginErrorCategory,
				error: 'Something new went wrong.',
			}),
		});

		const failure = wrapper.get('[data-test-id="protect-test-failure"]');

		expect(failure.text()).toContain('devicesUnifiProtectPlugin.testConnection.failed');
		expect(failure.text()).not.toContain('errorCategories.some_future_category');
		expect(wrapper.get('[data-test-id="protect-test-failure-detail"]').text()).toBe('Something new went wrong.');
	});

	it('shows a timeout without a failure category', async () => {
		const wrapper = mountTest({ timedOut: true });

		const timeout = wrapper.get('[data-test-id="protect-test-timeout"]');

		expect(timeout.text()).toContain('devicesUnifiProtectPlugin.testConnection.timeout.title');
		expect(wrapper.text()).not.toContain('devicesUnifiProtectPlugin.errorCategories.');
		expect(wrapper.find('[data-test-id="protect-test-failure"]').exists()).toBe(false);

		await wrapper.get('[data-test-id="protect-test-retry"]').trigger('click');

		expect(wrapper.emitted('test')).toHaveLength(1);
	});

	it('disables the test and shows the hint when no request can be built', async () => {
		const wrapper = mountTest({ hint: 'needs_key' });

		expect(wrapper.get('[data-test-id="protect-test-button"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('[data-test-id="protect-test-hint"]').text()).toBe('devicesUnifiProtectPlugin.testConnection.hints.needs_key');

		// The disabled button names the hint as its description.
		const hintId = wrapper.get('[data-test-id="protect-test-hint"]').attributes('id');

		expect(hintId).toBeTruthy();
		expect(wrapper.get('[data-test-id="protect-test-button"]').attributes('aria-describedby')).toBe(hintId);

		await wrapper.setProps({ hint: null });

		expect(wrapper.get('[data-test-id="protect-test-button"]').attributes('aria-describedby')).toBeUndefined();
		await wrapper.get('[data-test-id="protect-test-button"]').trigger('click');

		expect(wrapper.find('[data-test-id="protect-test-hint"]').exists()).toBe(false);
		expect(wrapper.emitted('test')).toHaveLength(1);
	});

	it('shows the returned certificate and passes trust through', async () => {
		const certificate = {
			fingerprintSha256: FINGERPRINT,
			subjectCommonName: 'unifi.local',
			issuerCommonName: 'unifi.local',
			subjectAltNames: ['unifi.local'],
			validFrom: '2026-01-01T00:00:00.000Z',
			validTo: '2036-01-01T00:00:00.000Z',
			selfSigned: true,
			trusted: false,
		};
		const wrapper = mountTest({
			result: passed({ success: false, certificate, errorCategory: DevicesUnifiProtectPluginErrorCategory.tls_untrusted, error: 'Untrusted.' }),
			trustable: 'untrusted',
		});

		await wrapper.get('[data-test-id="protect-certificate-trust"]').trigger('click');

		expect(wrapper.emitted('trust')).toEqual([[FINGERPRINT]]);
	});
});
