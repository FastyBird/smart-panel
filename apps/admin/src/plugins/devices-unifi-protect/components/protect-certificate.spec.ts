import { describe, expect, it, vi } from 'vitest';

import { mount } from '@vue/test-utils';

import type { IProtectCertificate } from '../store/protect.types';

import ProtectCertificate from './protect-certificate.vue';

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return {
		...actual,
		useI18n: () => ({
			t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
		}),
	};
});

const FINGERPRINT = 'ef'.repeat(32);

const certificate: IProtectCertificate = {
	fingerprintSha256: FINGERPRINT,
	subjectCommonName: 'unifi.local',
	issuerCommonName: 'UniFi CA',
	subjectAltNames: ['unifi.local', '192.168.1.10'],
	validFrom: '2026-01-01T00:00:00.000Z',
	validTo: '2036-01-01T00:00:00.000Z',
	selfSigned: true,
	trusted: false,
};

describe('ProtectCertificate', () => {
	it('shows the certificate details', () => {
		const wrapper = mount(ProtectCertificate, { props: { certificate, trustable: 'none' } });

		const text = wrapper.text();

		expect(text).toContain('unifi.local');
		expect(text).toContain('UniFi CA');
		expect(text).toContain('192.168.1.10');
		expect(text).toContain(FINGERPRINT);
		expect(wrapper.get('[data-test-id="protect-certificate-self-signed"]').text()).toBe('devicesUnifiProtectPlugin.certificate.yes');
		expect(wrapper.get('[data-test-id="protect-certificate-trusted"]').text()).toBe('devicesUnifiProtectPlugin.certificate.no');
		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(false);
		expect(wrapper.find('[data-test-id="protect-certificate-replace"]').exists()).toBe(false);
	});

	it('trusts an untrusted certificate in one step', async () => {
		const wrapper = mount(ProtectCertificate, { props: { certificate, trustable: 'untrusted' } });

		await wrapper.get('[data-test-id="protect-certificate-trust"]').trigger('click');

		expect(wrapper.emitted('trust')).toEqual([[FINGERPRINT]]);
	});

	it('asks for confirmation before replacing a changed pin', async () => {
		const wrapper = mount(ProtectCertificate, { props: { certificate, trustable: 'changed' } });

		expect(wrapper.get('[data-test-id="protect-certificate-changed"]').text()).toContain('devicesUnifiProtectPlugin.certificate.changed.title');
		expect(wrapper.find('[data-test-id="protect-certificate-trust"]').exists()).toBe(false);

		await wrapper.get('[data-test-id="protect-certificate-replace"]').trigger('click');

		expect(wrapper.emitted('trust')).toBeUndefined();

		await wrapper.get('[data-test-id="protect-certificate-cancel"]').trigger('click');

		expect(wrapper.find('[data-test-id="protect-certificate-confirm"]').exists()).toBe(false);

		await wrapper.get('[data-test-id="protect-certificate-replace"]').trigger('click');
		await wrapper.get('[data-test-id="protect-certificate-confirm"]').trigger('click');

		expect(wrapper.emitted('trust')).toEqual([[FINGERPRINT]]);
	});
});
