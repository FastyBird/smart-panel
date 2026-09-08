import { computed, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import type { IRemoteAccessProvider } from '../../../modules/remote-access';
import {
	RemoteAccessModuleEndpointScope,
	RemoteAccessModuleProviderKind,
	RemoteAccessModuleProviderState,
	UsersModuleUserRole,
} from '../../../openapi.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';

import TailscaleProviderCard from './tailscale-provider-card.vue';

// Only the mock functions themselves are hoisted - mirrors tailscale-setup-wizard.spec.ts.
const fns = vi.hoisted(() => ({
	fetchStatus: vi.fn(),
	fetchRemoteAccessStatus: vi.fn(),
	startService: vi.fn(),
	stopService: vi.fn(),
	restartService: vi.fn(),
	logout: vi.fn(),
	resetPreferences: vi.fn(),
	copy: vi.fn(),
	flashSuccess: vi.fn(),
	flashError: vi.fn(),
}));

const profile = ref<{ role: UsersModuleUserRole } | null>(null);
const status = ref<{ advisories: { code: string; message: string }[]; setup?: { state: string } | null } | null>(null);
const requirements = ref<{ code: string; satisfied: boolean; message: string; remedy: { commands: string[]; note: string | null } | null }[]>([]);
const isLoggingOut = ref(false);
const isResettingPreferences = ref(false);
const isActingReturn = ref(false);
const extension = ref<{ links?: { documentation?: string } } | null>(null);

vi.mock('vue-i18n', async () => {
	const actual = await vi.importActual('vue-i18n');

	return { ...actual, useI18n: () => ({ t: (key: string) => key }) };
});

vi.mock('../../../common', () => ({
	useFlashMessage: () => ({ success: fns.flashSuccess, error: fns.flashError }),
	useClipboard: () => ({ copy: fns.copy }),
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

vi.mock('../../../modules/remote-access', () => ({
	useRemoteAccessStatus: () => ({ fetchStatus: fns.fetchRemoteAccessStatus }),
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
		fns.fetchRemoteAccessStatus.mockReset().mockResolvedValue(undefined);
		fns.startService.mockReset().mockResolvedValue(true);
		fns.stopService.mockReset().mockResolvedValue(true);
		fns.restartService.mockReset().mockResolvedValue(true);
		fns.logout.mockReset();
		fns.resetPreferences.mockReset();
		fns.copy.mockReset().mockResolvedValue(true);
		fns.flashSuccess.mockReset();
		fns.flashError.mockReset();
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

	it('offers connect as the primary action, and reconnect plus the owner-only actions as secondary, for a disconnected node with a tailnet', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });

		const dropdown = wrapper.findComponent({ name: 'ElDropdown' });

		expect(dropdown.exists()).toBe(true);
		expect(dropdown.props('type')).toBeUndefined();
		expect(dropdown.text()).toContain('remoteAccessTailscalePlugin.buttons.connect');

		const items = wrapper.findAllComponents({ name: 'ElDropdownItem' });

		// "Reconnect" (POST /restart) is offered as a working fallback alongside "Connect" (POST
		// /start): the managed service is almost always already started by the time this state is
		// visible at all, which makes "Connect" fail with "already started" - see provider-actions.ts.
		expect(items.map((item) => item.props('command'))).toEqual(['reconnect', 'signOut', 'resetPreferences']);
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

	describe('refetch after connect/disconnect/reconnect (F1)', () => {
		it('refetches both the plugin and the module status once connect resolves successfully', async () => {
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');
			await flushPromises();

			expect(fns.startService).toHaveBeenCalled();
			expect(fns.fetchStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('still refetches both statuses when connect reports failure', async () => {
			fns.startService.mockResolvedValue(false);
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');
			await flushPromises();

			expect(fns.fetchStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('refetches both statuses once disconnect resolves', async () => {
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');
			await flushPromises();

			expect(fns.stopService).toHaveBeenCalled();
			expect(fns.fetchStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('still refetches both statuses when disconnect reports failure', async () => {
			fns.stopService.mockResolvedValue(false);
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');
			await flushPromises();

			expect(fns.fetchStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('refetches both statuses once reconnect resolves', async () => {
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.error });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');
			await flushPromises();

			expect(fns.restartService).toHaveBeenCalled();
			expect(fns.fetchStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('still refetches both statuses when reconnect reports failure', async () => {
			fns.restartService.mockResolvedValue(false);
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.error });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('click');
			await flushPromises();

			expect(fns.fetchStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});
	});

	describe('D12: "Cannot be used yet" banner', () => {
		it('shows the banner naming the first unsatisfied requirement while setup-required', () => {
			requirements.value = [
				{ code: 'binary-installed', satisfied: true, message: 'Tailscale is installed.', remedy: null },
				{ code: 'daemon-active', satisfied: false, message: 'tailscaled is not active.', remedy: null },
			];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			const alert = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle');

			expect(alert).toBeTruthy();
			expect(alert?.props('description')).toBe('tailscaled is not active.');
		});

		it('shows the banner naming the first unsatisfied requirement while not-installed', () => {
			requirements.value = [{ code: 'binary-installed', satisfied: false, message: 'Tailscale is not installed.', remedy: null }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.not_installed });

			const alert = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle');

			expect(alert?.props('description')).toBe('Tailscale is not installed.');
		});

		it('does not show the banner once every requirement is satisfied', () => {
			requirements.value = [{ code: 'binary-installed', satisfied: true, message: 'x', remedy: null }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			const alert = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle');

			expect(alert).toBeUndefined();
		});

		it('does not show the banner for a normal, non-blocked state', () => {
			requirements.value = [{ code: 'daemon-active', satisfied: false, message: 'x', remedy: null }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'x' } });

			const alert = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle');

			expect(alert).toBeUndefined();
		});
	});

	describe('D12: operator-not-granted advisory', () => {
		it('shows the advisory text and the copyable operator-grant command', () => {
			status.value = { advisories: [{ code: 'operator-not-granted', message: 'The smart-panel operator has not been granted.' }] };
			requirements.value = [
				{ code: 'operator-granted', satisfied: false, message: 'x', remedy: { commands: ['sudo tailscale set --operator=smart-panel'], note: null } },
			];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			expect(wrapper.text()).toContain('The smart-panel operator has not been granted.');
			expect(wrapper.text()).toContain('sudo tailscale set --operator=smart-panel');
		});

		it('copies the operator-grant command via the shared clipboard composable', async () => {
			status.value = { advisories: [{ code: 'operator-not-granted', message: 'x' }] };
			requirements.value = [
				{ code: 'operator-granted', satisfied: false, message: 'x', remedy: { commands: ['sudo tailscale set --operator=smart-panel'], note: null } },
			];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			const copyButton = wrapper
				.findAllComponents({ name: 'ElButton' })
				.find((button) => button.text().includes('remoteAccessTailscalePlugin.buttons.copy'));
			await copyButton?.vm.$emit('click');
			await flushPromises();

			expect(fns.copy).toHaveBeenCalledWith('sudo tailscale set --operator=smart-panel');
			expect(fns.flashSuccess).toHaveBeenCalledWith('remoteAccessTailscalePlugin.messages.commandCopied');
		});

		it('does not show the advisory block when there is no operator-not-granted advisory', () => {
			status.value = { advisories: [] };
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			expect(wrapper.text()).not.toContain('sudo tailscale set --operator');
		});
	});

	describe('D13: action error hints', () => {
		it('shows a recovery hint after sign-out fails with a known error code', async () => {
			fns.logout.mockRejectedValue(
				new RemoteAccessTailscaleApiException('The smart-panel operator has not been granted.', 409, null, 'operator-not-granted')
			);
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'signOut');
			await flushPromises();

			const hint = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.errors.operatorNotGranted');
			expect(hint).toBeTruthy();
		});

		it('shows a recovery hint after reset-preferences fails with a known error code', async () => {
			fns.resetPreferences.mockRejectedValue(new RemoteAccessTailscaleApiException('The daemon is not running.', 409, null, 'daemon-not-active'));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'resetPreferences');
			await flushPromises();

			const hint = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => alert.props('title') === 'remoteAccessTailscalePlugin.errors.daemonNotActive');
			expect(hint).toBeTruthy();
		});

		it('shows no hint for an unrecognised or absent error code', async () => {
			fns.logout.mockRejectedValue(new RemoteAccessTailscaleApiException('Internal error detail', 500));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'signOut');
			await flushPromises();

			const hint = wrapper
				.findAllComponents({ name: 'ElAlert' })
				.find((alert) => typeof alert.props('title') === 'string' && alert.props('title').startsWith('remoteAccessTailscalePlugin.errors.'));
			expect(hint).toBeUndefined();
		});

		it('shows the backend reason as a toast for a 409 sign-out failure', async () => {
			fns.logout.mockRejectedValue(new RemoteAccessTailscaleApiException('A prerequisite is not satisfied.', 409));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await wrapper.findComponent({ name: 'ElDropdown' }).vm.$emit('command', 'signOut');
			await flushPromises();

			expect(fns.flashError).toHaveBeenCalledWith('A prerequisite is not satisfied.');
		});
	});
});
