import { ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, shallowMount } from '@vue/test-utils';

import type { IService } from '../../../modules/extensions/store/services.store.types';
import type { IRemoteAccessProvider } from '../../../modules/remote-access';
import { UsersModuleUserRole } from '../../../openapi.constants';
import { useCloudflareTunnelStatusStore } from '../store/cloudflare-tunnel-status.store';

import CloudflareTunnelProviderCard from './cloudflare-tunnel-provider-card.vue';

const fns = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	aggregate: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
	restart: vi.fn(),
	fetchServices: vi.fn(),
	confirm: vi.fn(),
}));
const profile = ref({ role: UsersModuleUserRole.owner });
const services = ref<IService[]>([]);
const acting = ref(false);
let store: ReturnType<typeof useCloudflareTunnelStatusStore>;
let wrapper: VueWrapper;

vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client: { GET: fns.get, POST: fns.post } }),
	useLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
	injectStoresManager: () => ({ getStore: () => store }),
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock('vue-i18n', async () => ({ ...(await vi.importActual('vue-i18n')), useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('element-plus', async () => ({ ...(await vi.importActual('element-plus')), ElMessageBox: { confirm: fns.confirm } }));
vi.mock('../../../modules/auth/composables/composables', () => ({ useSession: () => ({ profile }) }));
vi.mock('../../../modules/extensions', () => ({
	useExtension: () => ({ extension: ref(null) }),
	useServices: () => ({ services, fetchServices: fns.fetchServices }),
	useServiceActions: () => ({ startService: fns.start, stopService: fns.stop, restartService: fns.restart, isActing: () => acting.value }),
}));
vi.mock('../../../modules/remote-access', async () => ({
	...(await vi.importActual('../../../modules/remote-access')),
	useRemoteAccessStatus: () => ({ fetchStatus: fns.aggregate }),
}));

const snapshot = (revision: number, state = 'disconnected') => ({
	epoch: 'backend-process',
	revision,
	type: 'remote-access-cloudflare-tunnel-plugin',
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
});
const response = (data: ReturnType<typeof snapshot>) => ({ data: { data }, response: { status: 200 } });
const setService = (state = 'stopped', enabled = true) => {
	services.value = [
		{ extensionKind: 'plugin', extensionType: 'remote-access-cloudflare-tunnel-plugin', serviceId: 'tunnel', state, enabled } as IService,
	];
};
const mountCard = async () => {
	wrapper = shallowMount(CloudflareTunnelProviderCard, {
		props: { provider: { ...snapshot(0), kind: 'tunnel', capabilities: {} } as unknown as IRemoteAccessProvider },
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
const click = async () => {
	primary().vm.$emit('click');
	await flushPromises();
};

describe('Cloudflare card with the real status store and Extensions lifecycle', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		profile.value = { role: UsersModuleUserRole.owner };
		acting.value = false;
		setActivePinia(createPinia());
		store = useCloudflareTunnelStatusStore();
		setService();
		fns.aggregate.mockResolvedValue(undefined);
		fns.fetchServices.mockResolvedValue(undefined);
		fns.confirm.mockResolvedValue(undefined);
		fns.get.mockResolvedValue(response(snapshot(1)));
	});
	afterEach(() => {
		wrapper?.unmount();
		vi.useRealTimers();
	});

	it('recovers the initial failed status request through the bounded fallback without a reload', async () => {
		setService('started');
		fns.get.mockRejectedValueOnce(new Error('network failure')).mockResolvedValue(response(snapshot(1, 'connected')));
		await mountCard();
		expect(store.data).toBeNull();
		await vi.advanceTimersByTimeAsync(30_000);
		await flushPromises();
		expect(store.data?.state).toBe('connected');
		expect(primary().text()).toContain('buttons.disconnect');
		expect(fns.get).toHaveBeenCalledTimes(2);
	});

	it('completes Connect → Disconnect → Connect with the existing valid service endpoints', async () => {
		let current = snapshot(1);
		fns.get.mockImplementation(() => Promise.resolve(response(current)));
		fns.start.mockImplementation(() => {
			setService('started');
			current = snapshot(current.revision + 1, 'connected');
			return Promise.resolve(true);
		});
		fns.stop.mockImplementation(() => {
			setService('stopped');
			current = snapshot(current.revision + 1);
			return Promise.resolve(true);
		});
		await mountCard();
		expect(primary().text()).toContain('buttons.connect');
		await click();
		expect(primary().text()).toContain('buttons.disconnect');
		await click();
		expect(primary().text()).toContain('buttons.connect');
		await click();
		expect(fns.start).toHaveBeenCalledTimes(2);
		expect(fns.stop).toHaveBeenCalledTimes(1);
		expect(fns.start).toHaveBeenCalledWith('plugin', 'remote-access-cloudflare-tunnel-plugin', 'tunnel');
		expect(fns.aggregate).toHaveBeenCalledTimes(3);
	});

	it('offers restart rather than invalid start for an already-started disconnected supervisor', async () => {
		setService('started');
		fns.restart.mockResolvedValue(false);
		await mountCard();
		expect(primary().text()).toContain('buttons.reconnect');
		await click();
		expect(fns.start).not.toHaveBeenCalled();
		expect(fns.restart).toHaveBeenCalledWith('plugin', 'remote-access-cloudflare-tunnel-plugin', 'tunnel');
		expect(fns.aggregate).toHaveBeenCalledTimes(1);
	});

	it('uses REST reconciliation to leave connecting when completion events are lost', async () => {
		setService('started');
		fns.get.mockResolvedValueOnce(response(snapshot(1, 'connecting'))).mockResolvedValue(response(snapshot(2, 'connected')));
		await mountCard();
		await vi.advanceTimersByTimeAsync(5_000);
		await flushPromises();
		expect(store.data?.state).toBe('connected');
		expect(fns.get).toHaveBeenCalledTimes(2);
		wrapper.unmount();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(fns.get).toHaveBeenCalledTimes(2);
	});

	it('parses the complete backend remove response and refreshes lifecycle/aggregate state', async () => {
		setService('started');
		let current = snapshot(1, 'connected');
		fns.get.mockImplementation(() => Promise.resolve(response(current)));
		fns.post.mockImplementation(() => {
			current = snapshot(2, 'setup-required');
			setService();
			return Promise.resolve(response(current));
		});
		await mountCard();
		primary().vm.$emit('command', 'remove');
		await flushPromises();
		expect(fns.post).toHaveBeenCalledWith('/plugins/remote-access-cloudflare-tunnel/reset', { signal: expect.any(AbortSignal) });
		expect(store.data?.privilegedSetup?.available).toBe(true);
		expect(primary().text()).toContain('buttons.configure');
		expect(store.semaphore.resetting).toBe(false);
		expect(fns.aggregate).toHaveBeenCalledTimes(1);
	});

	it('blocks repeated local actions while a service operation runs', async () => {
		await mountCard();
		acting.value = true;
		await flushPromises();
		expect(primary().props('disabled')).toBe(true);
		await click();
		expect(fns.start).not.toHaveBeenCalled();
	});

	it.each(['disabled', 'regular-user'])('hides lifecycle actions for %s', async (reason) => {
		if (reason === 'disabled') setService('stopped', false);
		else profile.value = { role: UsersModuleUserRole.user };
		await mountCard();
		expect(primary().exists()).toBe(false);
	});
});
