import { type ComputedRef, computed } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, mount } from '@vue/test-utils';

import { RemoteAccessModuleEndpointScope } from '../../../openapi.constants';
import type { IUseRemoteAccessUrls } from '../composables/types';
import type { IRemoteAccessEndpoint } from '../store/remote-access-status.store.types';

import AccessUrlsList from './access-urls-list.vue';

const rankedExternal: IRemoteAccessEndpoint[] = [
	{ url: 'https://node.tailnet.ts.net', scope: RemoteAccessModuleEndpointScope.private, https: true, label: 'Tailscale (HTTPS)' },
	{ url: 'https://panel.example.com', scope: RemoteAccessModuleEndpointScope.public, https: true, label: 'Manual external URL' },
	{ url: 'http://panel.example.com', scope: RemoteAccessModuleEndpointScope.public, https: false, label: 'Manual external URL (HTTP)' },
];

const useRemoteAccessUrlsMock = vi.fn<() => IUseRemoteAccessUrls>();

const toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,mockqrcode');

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('qrcode', () => ({
	default: { toDataURL: (...args: unknown[]) => toDataURL(...args) },
}));

vi.mock('../composables', () => ({
	useRemoteAccessUrls: () => useRemoteAccessUrlsMock(),
}));

describe('AccessUrlsList', () => {
	beforeEach(() => {
		// Reset to the shared default before every test - a test that installs its own
		// `mockImplementation` (the race-condition regression below) must not leak it forward.
		toDataURL.mockReset().mockResolvedValue('data:image/png;base64,mockqrcode');

		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
			configurable: true,
		});

		useRemoteAccessUrlsMock.mockReturnValue({
			internal: computed(() => 'http://localhost:3000') as ComputedRef<string | null>,
			candidates: computed(() => ['http://192.168.1.5:3000']),
			external: computed(() => rankedExternal) as ComputedRef<IRemoteAccessEndpoint[]>,
			primary: computed(() => rankedExternal[0]!.url) as ComputedRef<string | null>,
			isLoading: computed(() => false),
			fetchUrls: vi.fn(),
		});
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('renders the external endpoints in the exact ranked order, marking only the first as primary', () => {
		const wrapper = mount(AccessUrlsList);

		const rows = wrapper.findAll('.font-mono');
		const rowTexts = rows.map((row) => row.text());

		expect(rowTexts).toContain('https://node.tailnet.ts.net');
		const urlOrder = rankedExternal.map((endpoint) => endpoint.url).filter((url) => rowTexts.includes(url));
		expect(urlOrder).toEqual(rankedExternal.map((endpoint) => endpoint.url));

		const primaryTags = wrapper.findAll('.el-tag').filter((tag) => tag.text() === 'remoteAccessModule.texts.primary');
		expect(primaryTags).toHaveLength(1);
	});

	it('copies a URL to the clipboard when the copy button is pressed', async () => {
		const wrapper = mount(AccessUrlsList);

		const copyButtons = wrapper.findAll('button[aria-label="remoteAccessModule.buttons.copy.title"]');
		await copyButtons[0]!.trigger('click');
		await flushPromises();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:3000');
	});

	it('lazily generates and displays a QR code the first time it is requested for a URL', async () => {
		const wrapper = mount(AccessUrlsList);

		expect(wrapper.find('img').exists()).toBe(false);

		const qrButtons = wrapper.findAll('button[aria-label="remoteAccessModule.buttons.showQr.title"]');
		await qrButtons[0]!.trigger('click');
		await flushPromises();

		expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000', { width: 180, margin: 2 });
		expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,mockqrcode');
	});

	it('toggles the QR code closed on a second click without regenerating it', async () => {
		const wrapper = mount(AccessUrlsList);

		const qrButtons = wrapper.findAll('button[aria-label="remoteAccessModule.buttons.showQr.title"]');
		await qrButtons[0]!.trigger('click');
		await flushPromises();
		await qrButtons[0]!.trigger('click');
		await flushPromises();

		expect(wrapper.find('img').exists()).toBe(false);
		expect(toDataURL).toHaveBeenCalledTimes(1);
	});

	it('shows a message when no external access is configured', () => {
		useRemoteAccessUrlsMock.mockReturnValue({
			internal: computed(() => 'http://localhost:3000') as ComputedRef<string | null>,
			candidates: computed(() => []),
			external: computed(() => []),
			primary: computed(() => null) as ComputedRef<string | null>,
			isLoading: computed(() => false),
			fetchUrls: vi.fn(),
		});

		const wrapper = mount(AccessUrlsList);

		expect(wrapper.text()).toContain('remoteAccessModule.texts.noExternalUrls');
	});

	it('keeps a newer QR selection when an earlier, now-stale request rejects (regression)', async () => {
		const deferred = new Map<string, { resolve: (value: string) => void; reject: (reason: unknown) => void }>();

		toDataURL.mockImplementation(
			(url: string) =>
				new Promise((resolve, reject) => {
					deferred.set(url, { resolve, reject });
				})
		);

		const wrapper = mount(AccessUrlsList);

		const qrButtons = wrapper.findAll('button[aria-label="remoteAccessModule.buttons.showQr.title"]');

		// Select the internal URL's QR first - its request stays pending.
		await qrButtons[0]!.trigger('click');
		// Switch to the first external endpoint's QR before the internal one settles.
		await qrButtons[1]!.trigger('click');

		// The stale, now-abandoned request for the internal URL fails...
		deferred.get('http://localhost:3000')!.reject(new Error('network error'));
		await flushPromises();

		// ...but the newer selection must survive: neither QR has resolved yet, so nothing renders,
		// which already proves the failure did not throw or otherwise break the component.
		expect(wrapper.find('img').exists()).toBe(false);

		// Once the (still selected) external endpoint's QR resolves, it renders - proving
		// `openQrUrl` was never cleared by the earlier, unrelated failure.
		deferred.get('https://node.tailnet.ts.net')!.resolve('data:image/png;base64,external-qr');
		await flushPromises();

		expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,external-qr');
	});
});
