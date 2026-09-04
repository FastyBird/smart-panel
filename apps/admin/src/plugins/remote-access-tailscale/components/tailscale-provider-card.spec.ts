import { computed, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { shallowMount } from '@vue/test-utils';

import type { IRemoteAccessProvider } from '../../../modules/remote-access';
import {
	RemoteAccessModuleEndpointScope,
	RemoteAccessModuleProviderKind,
	RemoteAccessModuleProviderState,
	UsersModuleUserRole,
} from '../../../openapi.constants';

import TailscaleProviderCard from './tailscale-provider-card.vue';

// Only the mock functions themselves are hoisted - mirrors tailscale-setup-wizard.spec.ts.
const fns = vi.hoisted(() => ({
	fetchStatus: vi.fn(),
	startService: vi.fn(),
	stopService: vi.fn(),
	restartService: vi.fn(),
	logout: vi.fn(),
	resetPreferences: vi.fn(),
}));

const profile = ref<{ role: UsersModuleUserRole } | null>(null);
const status = ref<null>(null);
const requirements = ref<{ code: string; satisfied: boolean; message: string }[]>([]);
const isLoggingOut = ref(false);
const isResettingPreferences = ref(false);
const isActingReturn = ref(false);
const extension = ref<{ links?: { documentation?: string } } | null>(null);

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('../../../modules/auth/composables/composables', () => ({
	useSession: () => ({ profile, isSignedIn: computed(() => profile.value !== null) }),
}));

vi.mock('../../../modules/extensions', () => ({
	useExtension: () => ({ extension, isLoading: computed(() => false), fetchExtension: vi.fn() }),
	useServiceActions: () => ({
		startService: fns.startService,
		stopService: fns.stopService,
		restartService: fns.restartService,
		isActing: () => isActingReturn.value,
	}),
}));

vi.mock('../composables', () => ({
	useTailscaleStatus: () => ({
		status,
		requirements,
		isLoading: computed(() => false),
		isLoggingOut,
		isResettingPreferences,
		fetchStatus: fns.fetchStatus,
		logout: fns.logout,
		resetPreferences: fns.resetPreferences,
	}),
}));

const baseProvider: IRemoteAccessProvider = {
	type: 'remote-access-tailscale-plugin',
	kind: RemoteAccessModuleProviderKind.mesh,
	capabilities: { https: true, publicUrl: false, identityHeaders: false, ssh: true },
	state: RemoteAccessModuleProviderState.setup_required,
	endpoints: [],
	message: null,
	details: {},
	proxyAddresses: [],
	advisories: [],
	updatedAt: '2026-01-01T00:00:00.000Z',
};

const mountCard = (provider: Partial<IRemoteAccessProvider>) =>
	shallowMount(TailscaleProviderCard, {
		props: { provider: { ...baseProvider, ...provider } },
		global: {
			// Stubbed children keep their slot content as plain text - mirrors
			// tailscale-setup-wizard.spec.ts (the split button's default slot is the action label).
			renderStubDefaultSlot: true,
			stubs: {
				// The card's state/HTTPS tags live in ElCard's `#header` and `#footer` named
				// slots - the generic auto-stub shallowMount gives every other child only ever
				// renders an unnamed default slot, so ElCard has to render for real.
				ElCard: false,
				// ElDropdown is a real Popper/Teleport-based component - letting it render for
				// real under shallowMount (whose auto-stub still replaces its internal button/
				// tooltip children) throws deep in Vue's DOM patcher in jsdom. A small stub that
				// forwards both the default slot (the main button's label) and the `#dropdown`
				// named slot (the secondary actions) exercises the same primary/secondary mapping
				// without going through Popper, while still keeping `type`/`loading` inspectable
				// via `.props(...)` and `@click`/`@command` triggerable via `.vm.$emit(...)`.
				ElDropdown: {
					name: 'ElDropdown',
					props: ['type', 'loading'],
					template: '<div><slot /><slot name="dropdown" /></div>',
				},
			},
		},
	});

describe('TailscaleProviderCard', () => {
	beforeEach(() => {
		profile.value = { role: UsersModuleUserRole.owner };
		status.value = null;
		requirements.value = [];
		isLoggingOut.value = false;
		isResettingPreferences.value = false;
		isActingReturn.value = false;
		extension.value = null;
		fns.fetchStatus.mockReset().mockResolvedValue(undefined);
		fns.startService.mockReset();
		fns.stopService.mockReset();
		fns.restartService.mockReset();
		fns.logout.mockReset();
		fns.resetPreferences.mockReset();
	});

	it('offers setup as the primary action for an owner on a fresh node, with no secondary actions', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

		const dropdown = wrapper.findComponent({ name: 'ElDropdown' });

		expect(dropdown.exists()).toBe(true);
		expect(dropdown.props('type')).toBe('primary');
		expect(dropdown.text()).toContain('remoteAccessTailscalePlugin.buttons.setup');
		expect(wrapper.findAllComponents({ name: 'ElDropdownItem' })).toHaveLength(0);
	});

	it('clicking the main button runs the primary action', async () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });

		await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');

		expect(fns.startService).toHaveBeenCalledWith('plugin', 'remote-access-tailscale-plugin', 'node');
	});

	it('offers connect as the primary action, and the owner-only actions as secondary, for a disconnected node with a tailnet', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });

		const dropdown = wrapper.findComponent({ name: 'ElDropdown' });

		expect(dropdown.exists()).toBe(true);
		expect(dropdown.props('type')).toBeUndefined();
		expect(dropdown.text()).toContain('remoteAccessTailscalePlugin.buttons.connect');

		const items = wrapper.findAllComponents({ name: 'ElDropdownItem' });

		expect(items.map((item) => item.props('command'))).toEqual(['signOut', 'resetPreferences']);
	});

	it('offers disconnect as the primary action and reconnect plus the owner-only actions as secondary for a connected node', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

		const dropdown = wrapper.findComponent({ name: 'ElDropdown' });

		expect(dropdown.exists()).toBe(true);
		expect(dropdown.props('type')).toBeUndefined();
		expect(dropdown.text()).toContain('remoteAccessTailscalePlugin.buttons.disconnect');

		const items = wrapper.findAllComponents({ name: 'ElDropdownItem' });

		expect(items.map((item) => item.props('command'))).toEqual(['reconnect', 'signOut', 'resetPreferences']);
	});

	it('renders no dropdown when the viewer is not the owner and no self-service action applies', () => {
		profile.value = { role: UsersModuleUserRole.user };

		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

		expect(wrapper.findComponent({ name: 'ElDropdown' }).exists()).toBe(false);
	});

	it('shows the HTTPS tag when an https endpoint exists', () => {
		const wrapper = mountCard({
			state: RemoteAccessModuleProviderState.connected,
			endpoints: [{ url: 'https://node.tailnet.ts.net', scope: RemoteAccessModuleEndpointScope.private, https: true, label: 'Tailscale (HTTPS)' }],
		});

		const tags = wrapper.findAllComponents({ name: 'ElTag' });

		expect(tags.some((tag) => tag.text().includes('remoteAccessModule.texts.https'))).toBe(true);
	});

	it('does not show the HTTPS tag when there is no https endpoint', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected, endpoints: [] });

		const tags = wrapper.findAllComponents({ name: 'ElTag' });

		expect(tags.some((tag) => tag.text().includes('remoteAccessModule.texts.https'))).toBe(false);
	});
});
