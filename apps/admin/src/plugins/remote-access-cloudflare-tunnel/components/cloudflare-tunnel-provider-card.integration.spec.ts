import { ref } from 'vue';

import { createPinia, setActivePinia } from 'pinia';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type VueWrapper, flushPromises, shallowMount } from '@vue/test-utils';

import { servicesStoreKey } from '../../../modules/extensions/store/keys';
import { useServices as useServicesStore } from '../../../modules/extensions/store/services.store';
import type { IRemoteAccessProvider } from '../../../modules/remote-access';
import { ExtensionsModuleServiceOwnerKind, UsersModuleUserRole } from '../../../openapi.constants';
import { useCloudflareTunnelStatusStore } from '../store/cloudflare-tunnel-status.store';

import CloudflareTunnelProviderCard from './cloudflare-tunnel-provider-card.vue';

const fns = vi.hoisted(() => ({
	get: vi.fn(),
	post: vi.fn(),
	aggregate: vi.fn(),
	confirm: vi.fn(),
}));
const profile = ref({ role: UsersModuleUserRole.owner });
let servicesStore: ReturnType<typeof useServicesStore>;
let store: ReturnType<typeof useCloudflareTunnelStatusStore>;
let wrapper: VueWrapper;

vi.mock('../../../common', async () => ({
	...(await vi.importActual('../../../common')),
	useBackend: () => ({ client: { GET: fns.get, POST: fns.post } }),
	useLogger: () => ({ error: vi.fn(), warn: vi.fn() }),
	injectStoresManager: () => ({ getStore: (key: symbol) => (key === servicesStoreKey ? servicesStore : store) }),
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));
vi.mock('../../../common/services/store', () => ({
	injectStoresManager: () => ({ getStore: (key: symbol) => (key === servicesStoreKey ? servicesStore : store) }),
}));
vi.mock('vue-i18n', async () => ({ ...(await vi.importActual('vue-i18n')), useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('element-plus', async () => ({ ...(await vi.importActual('element-plus')), ElMessageBox: { confirm: fns.confirm } }));
vi.mock('../../../modules/auth/composables/composables', () => ({ useSession: () => ({ profile }) }));
vi.mock('../../../modules/extensions', async () => ({
	...(await vi.importActual('../../../modules/extensions')),
	useExtension: () => ({ extension: ref(null) }),
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
const serviceResponse = (state = 'stopped') => ({
	extension_kind: 'plugin',
	extension_type: 'remote-access-cloudflare-tunnel-plugin',
	service_id: 'tunnel',
	activation_policy: 'owner-enabled',
	state,
	desired_state: 'started',
	enabled: true,
	start_count: 1,
});
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

describe('Cloudflare card with real Extensions lifecycle requests', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.resetAllMocks();
		setActivePinia(createPinia());
		store = useCloudflareTunnelStatusStore();
		servicesStore = useServicesStore();
		fns.aggregate.mockResolvedValue(undefined);
		fns.confirm.mockResolvedValue(undefined);
	});

	afterEach(() => {
		wrapper?.unmount();
		vi.useRealTimers();
	});

	it.each(['start', 'stop', 'restart'] as const)(
		'releases card busy after a lost %s reply, refreshes services and permits a retry',
		async (action) => {
			let currentState = action === 'start' ? 'stopped' : 'started';
			let revision = 0;
			fns.get.mockImplementation((path: string) =>
				Promise.resolve(
					path === '/modules/extensions/services'
						? { data: { data: [serviceResponse(currentState)] }, response: { status: 200 } }
						: response(snapshot(++revision, currentState === 'stopped' ? 'disconnected' : 'connected'))
				)
			);
			let signal: AbortSignal | undefined;
			fns.post.mockImplementationOnce((_path, options: { signal?: AbortSignal }) => {
				signal = options?.signal;
				// The backend can finish even when its HTTP reply is lost.
				currentState = action === 'stop' ? 'stopped' : 'started';
				return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal?.reason), { once: true }));
			});
			await mountCard();
			const invoke = async () => {
				if (action === 'restart') primary().vm.$emit('command', 'reconnect');
				else primary().vm.$emit('click');
				await flushPromises();
			};
			await invoke();
			expect(primary().props('loading')).toBe(true);
			expect(servicesStore.acting(ExtensionsModuleServiceOwnerKind.plugin, 'remote-access-cloudflare-tunnel-plugin', 'tunnel')).toBe(true);
			await vi.advanceTimersByTimeAsync(60_000);
			await flushPromises();
			expect(signal?.aborted).toBe(true);
			expect(primary().props('loading')).toBe(false);
			expect(primary().text()).toContain(action === 'stop' ? 'buttons.connect' : 'buttons.disconnect');
			expect(servicesStore.acting(ExtensionsModuleServiceOwnerKind.plugin, 'remote-access-cloudflare-tunnel-plugin', 'tunnel')).toBe(false);
			expect(servicesStore.findByKey(ExtensionsModuleServiceOwnerKind.plugin, 'remote-access-cloudflare-tunnel-plugin', 'tunnel')?.state).toBe(
				currentState
			);
			expect(fns.aggregate).toHaveBeenCalledTimes(1);
			expect(fns.post).toHaveBeenCalledTimes(1);
			// Reset observed state through the same store refresh so the original action is offered again.
			currentState = action === 'start' ? 'stopped' : 'started';
			await servicesStore.fetch();
			await store.refresh();
			await flushPromises();
			fns.post.mockResolvedValueOnce({ data: { data: serviceResponse(action === 'stop' ? 'stopped' : 'started') }, response: { status: 200 } });
			await invoke();
			expect(fns.post).toHaveBeenCalledTimes(2);
			expect(fns.post.mock.calls.map(([path]) => path)).toEqual([
				`/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}/${action}`,
				`/modules/extensions/services/{extensionKind}/{extensionType}/{serviceId}/${action}`,
			]);
			expect(primary().props('loading')).toBe(false);
		}
	);

	it('recovers a lost initial services refresh on the card fallback cadence', async () => {
		let signal: AbortSignal | undefined;
		let reads = 0;
		fns.get.mockImplementation((path: string, options: { signal?: AbortSignal }) => {
			if (path !== '/modules/extensions/services') return Promise.resolve(response(snapshot(1)));
			if (++reads > 1) return Promise.resolve({ data: { data: [serviceResponse()] }, response: { status: 200 } });
			signal = options?.signal;
			return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(signal?.reason), { once: true }));
		});
		await mountCard();
		expect(servicesStore.fetching()).toBe(true);
		await vi.advanceTimersByTimeAsync(20_000);
		await flushPromises();
		expect(signal?.aborted).toBe(true);
		expect(servicesStore.fetching()).toBe(false);
		await vi.advanceTimersByTimeAsync(10_000);
		await flushPromises();
		expect(reads).toBe(2);
		expect(primary().text()).toContain('buttons.connect');
	});
});
