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

// A plain top-level `vi.fn()` const, not `vi.hoisted()` - mirrors `useRemoteAccessUrlsMock` above: `vi.fn()` does not
// depend on any import that needs linking first, so it is safe to reference from the `vi.mock` factory below.
const flashErrorMock = vi.fn();

vi.mock('vue-i18n', () => ({
	createI18n: () => ({ global: { locale: { value: 'en-US' }, getLocaleMessage: () => ({}), setLocaleMessage: () => {} } }),
	useI18n: () => ({
		t: (key: string) => key,
	}),
}));

vi.mock('qrcode', () => ({
	default: { toDataURL: (...args: unknown[]) => toDataURL(...args) },
}));

// Copying belongs to the shared copy field (covered by its own spec): here it only has to show the right value
vi.mock('../../../common', () => ({
	CopyField: { name: 'CopyField', props: ['value'], template: '<div class="copy-field">{{ value }}</div>' },
	StatusTag: { name: 'StatusTag', props: ['status', 'label'], template: '<span class="status-tag">{{ label }}</span>' },
	useFlashMessage: () => ({ success: vi.fn(), error: flashErrorMock }),
}));

const qrToggles = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('[data-test-id="access-url-qr-toggle"]');

vi.mock('../composables', () => ({
	useRemoteAccessUrls: () => useRemoteAccessUrlsMock(),
}));

describe('AccessUrlsList', () => {
	beforeEach(() => {
		// Reset to the shared default before every test - a test that installs its own
		// `mockImplementation` (the race-condition regression below) must not leak it forward.
		toDataURL.mockReset().mockResolvedValue('data:image/png;base64,mockqrcode');

		flashErrorMock.mockReset();

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

	it('renders the internal URL, its candidates and the external endpoints in their ranked order, marking only the first as primary', () => {
		const wrapper = mount(AccessUrlsList);

		const values = wrapper.findAllComponents({ name: 'CopyField' }).map((field) => field.props('value'));

		expect(values).toEqual(['http://localhost:3000', 'http://192.168.1.5:3000', ...rankedExternal.map((endpoint) => endpoint.url)]);

		const primaryTags = wrapper.findAllComponents({ name: 'StatusTag' }).filter((tag) => tag.props('label') === 'remoteAccessModule.texts.primary');
		expect(primaryTags).toHaveLength(1);
	});

	it('tags each external endpoint with its transport and scope', () => {
		const wrapper = mount(AccessUrlsList);

		const external = wrapper.findAll('[data-test-id="access-url-external"]');
		const tags = wrapper.findAllComponents({ name: 'StatusTag' });
		const labels = (index: number): string[] =>
			tags.filter((tag) => external[index]!.element.contains(tag.element)).map((tag) => `${tag.props('status')}:${tag.props('label')}`);

		expect(labels(1)).toEqual(['ok:remoteAccessModule.texts.https', 'warn:remoteAccessModule.texts.public']);
		expect(labels(2)).toEqual(['warn:remoteAccessModule.texts.http', 'warn:remoteAccessModule.texts.public']);
	});

	it('lazily generates and displays a QR code the first time it is requested for a URL', async () => {
		const wrapper = mount(AccessUrlsList);

		expect(wrapper.find('img').exists()).toBe(false);

		const qrButtons = qrToggles(wrapper);
		expect(qrButtons[0]!.attributes('aria-expanded')).toBe('false');
		await qrButtons[0]!.trigger('click');
		await flushPromises();

		expect(qrToggles(wrapper)[0]!.attributes('aria-expanded')).toBe('true');
		expect(qrToggles(wrapper)[0]!.text()).toContain('remoteAccessModule.buttons.hideQr.title');
		expect(toDataURL).toHaveBeenCalledWith('http://localhost:3000', { width: 180, margin: 2 });
		expect(wrapper.find('img').attributes('src')).toBe('data:image/png;base64,mockqrcode');
	});

	it('toggles the QR code closed on a second click without regenerating it', async () => {
		const wrapper = mount(AccessUrlsList);

		const qrButtons = qrToggles(wrapper);
		await qrButtons[0]!.trigger('click');
		await flushPromises();
		await qrButtons[0]!.trigger('click');
		await flushPromises();

		expect(wrapper.find('img').exists()).toBe(false);
		expect(toDataURL).toHaveBeenCalledTimes(1);
	});

	it('reports a QR code that cannot be generated and closes it', async () => {
		toDataURL.mockRejectedValue(new Error('too long'));

		const wrapper = mount(AccessUrlsList);

		await qrToggles(wrapper)[0]!.trigger('click');
		await flushPromises();

		expect(flashErrorMock).toHaveBeenCalledWith('remoteAccessModule.messages.qrFailed');
		expect(qrToggles(wrapper)[0]!.attributes('aria-expanded')).toBe('false');
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

		const qrButtons = qrToggles(wrapper);

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
