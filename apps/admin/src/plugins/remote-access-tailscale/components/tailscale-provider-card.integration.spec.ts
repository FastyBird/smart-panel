import { ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, shallowMount } from '@vue/test-utils';

import type { IRemoteAccessProvider } from '../../../modules/remote-access';
import { EventType } from '../../../modules/remote-access';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { useTailscaleStatusStore } from '../store/tailscale-status.store';

import TailscaleProviderCard from './tailscale-provider-card.vue';

const fns = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), aggregate: vi.fn(), flashError: vi.fn() }));
const profile = ref({ role: UsersModuleUserRole.owner });
let store: ReturnType<typeof useTailscaleStatusStore>;
let wrapper: VueWrapper;

vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client: { GET: fns.get, POST: fns.post } }),
	useLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
	injectStoresManager: () => ({ getStore: () => store }),
	useFlashMessage: () => ({ success: vi.fn(), error: fns.flashError }),
	useClipboard: () => ({ copy: vi.fn() }),
}));
vi.mock('vue-i18n', async () => ({ ...(await vi.importActual('vue-i18n')), useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('../../../modules/auth/composables/composables', () => ({ useSession: () => ({ profile }) }));
vi.mock('../../../modules/extensions', () => ({ useExtension: () => ({ extension: ref(null) }) }));
vi.mock('../../../modules/remote-access', async () => ({
	...(await vi.importActual('../../../modules/remote-access')),
	useRemoteAccessStatus: () => ({ fetchStatus: fns.aggregate }),
}));

const snapshot = (revision: number, state = 'disconnected', serviceState = 'stopped', operation: string | null = null, actions = ['connect']) => ({
	epoch: 'backend-process',
	revision,
	type: 'remote-access-tailscale-plugin',
	state,
	endpoints: [],
	message: null,
	details: {},
	proxy_addresses: [],
	advisories: [],
	updated_at: '2026-10-04T00:00:00Z',
	requirements: [{ code: 'binary-installed', satisfied: true, message: 'Installed', remedy: null }],
	setup: null,
	privileged_setup: { available: true, reason: null },
	control: { enabled: true, service_state: serviceState, authentication: 'authenticated', operation, available_actions: actions },
});
const response = (data: ReturnType<typeof snapshot>) => ({ data: { data }, response: { status: 200 } });
const mountCard = async () => {
	wrapper = shallowMount(TailscaleProviderCard, {
		props: { provider: { ...snapshot(0), kind: 'mesh', capabilities: {} } as unknown as IRemoteAccessProvider },
		global: {
			renderStubDefaultSlot: true,
			stubs: {
				ElCard: false,
				ElDropdown: { name: 'ElDropdown', props: ['loading', 'disabled'], template: '<div><slot /><slot name="dropdown" /></div>' },
			},
		},
	});
	await flushPromises();
};
const primary = () => wrapper.findComponent({ name: 'ElDropdown' });
const hasBusyAlert = () =>
	wrapper.findAllComponents({ name: 'ElAlert' }).some((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.texts.operationInProgress');
const click = async () => {
	primary().vm.$emit('click');
	await flushPromises();
};

describe('Tailscale card with the real status store and backend envelopes', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		profile.value = { role: UsersModuleUserRole.owner };
		setActivePinia(createPinia());
		store = useTailscaleStatusStore();
		fns.aggregate.mockResolvedValue(undefined);
		fns.get.mockResolvedValue(response(snapshot(1)));
	});
	afterEach(() => {
		wrapper?.unmount();
		vi.useRealTimers();
	});

	it('recovers the initial failed status request through the bounded fallback without a reload', async () => {
		fns.get.mockRejectedValueOnce(new Error('network failure')).mockResolvedValue(response(snapshot(1)));
		await mountCard();
		expect(store.data).toBeNull();
		expect(primary().exists()).toBe(false);
		await vi.advanceTimersByTimeAsync(30_000);
		await flushPromises();
		expect(store.data?.control?.availableActions).toEqual(['connect']);
		expect(primary().text()).toContain('buttons.connect');
		expect(fns.get).toHaveBeenCalledTimes(2);
	});

	it.each(['stopped', 'started'])('completes Connect → Disconnect → Connect without tailnet metadata, reload or login (%s)', async (serviceState) => {
		let current = snapshot(1, 'disconnected', serviceState);
		fns.get.mockImplementation(() => Promise.resolve(response(current)));
		fns.post.mockImplementation((path: string) => {
			const disconnect = path.endsWith('/disconnect');
			current = snapshot(
				current.revision + 1,
				disconnect ? 'disconnected' : 'connected',
				disconnect ? 'stopped' : 'started',
				null,
				disconnect ? ['connect'] : ['disconnect']
			);
			return Promise.resolve(response(current));
		});
		await mountCard();
		expect(primary().text()).toContain('buttons.connect');
		await click();
		expect(primary().text()).toContain('buttons.disconnect');
		await click();
		expect(primary().text()).toContain('buttons.connect');
		expect(primary().text()).not.toContain('buttons.signIn');
		await click();
		expect(primary().text()).toContain('buttons.disconnect');
		expect(fns.post.mock.calls.map(([path]) => path)).toEqual([
			'/plugins/remote-access-tailscale/connect',
			'/plugins/remote-access-tailscale/disconnect',
			'/plugins/remote-access-tailscale/connect',
		]);
		expect(store.data?.control?.authentication).toBe('authenticated');
	});

	it('reconciles a backend operation even when every completion event is lost', async () => {
		fns.get
			.mockResolvedValueOnce(response(snapshot(1, 'connecting', 'started', 'connect', ['disconnect'])))
			.mockResolvedValue(response(snapshot(2, 'connected', 'started', null, ['disconnect'])));
		await mountCard();
		expect(hasBusyAlert()).toBe(true);
		await vi.advanceTimersByTimeAsync(5_000);
		await flushPromises();
		expect(hasBusyAlert()).toBe(false);
		expect(store.data?.control?.operation).toBeNull();
		expect(fns.get).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(fns.get).toHaveBeenCalledTimes(2);
	});

	it('refreshes private control after a public event without a GET/event loop', async () => {
		fns.get.mockResolvedValueOnce(response(snapshot(1, 'connected', 'started', null, ['disconnect']))).mockResolvedValue(response(snapshot(2)));
		await mountCard();
		const event = snapshot(2);
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: event });
		await flushPromises();
		expect(primary().text()).toContain('buttons.connect');
		expect(fns.get).toHaveBeenCalledTimes(2);
		store.onEvent({ event: EventType.PROVIDER_STATUS, data: event });
		await flushPromises();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(fns.get).toHaveBeenCalledTimes(2);
	});

	it('reconciles after a failed Connect, exposes the error code hint and releases busy', async () => {
		fns.post.mockResolvedValue({ error: { error: { details: { code: 'not-signed-in', reason: 'Sign in first.' } } }, response: { status: 409 } });
		await mountCard();
		await click();
		expect(store.semaphore.connecting).toBe(false);
		expect(primary().props('loading')).toBe(false);
		expect(
			wrapper.findAllComponents({ name: 'ElAlert' }).some((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.errors.notSignedIn')
		).toBe(true);
		expect(fns.aggregate).toHaveBeenCalledTimes(1);
		expect(fns.get).toHaveBeenCalledTimes(2);
	});

	it('permits cancelling backend login while showing its busy feedback', async () => {
		fns.get.mockResolvedValue(response(snapshot(1, 'pending-auth', 'started', 'login', ['disconnect'])));
		fns.post.mockResolvedValue(response(snapshot(2)));
		await mountCard();
		expect(hasBusyAlert()).toBe(true);
		expect(primary().props('disabled')).toBe(false);
		await click();
		expect(fns.post).toHaveBeenCalledWith('/plugins/remote-access-tailscale/disconnect', { signal: expect.any(AbortSignal) });
	});

	it('fails closed without the administrative control contract instead of inferring authentication from a label', async () => {
		fns.get.mockResolvedValue({
			data: { data: { ...snapshot(1), control: undefined, details: { tailnet: 'example.ts.net' } } },
			response: { status: 200 },
		});
		await mountCard();
		expect(primary().exists()).toBe(false);
	});

	it('fails closed for absent control and regular users, and clears its fallback on unmount', async () => {
		profile.value = { role: UsersModuleUserRole.user };
		await mountCard();
		expect(primary().exists()).toBe(false);
		wrapper.unmount();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fns.get).toHaveBeenCalledTimes(1);
	});
});
