import { computed, ref } from 'vue';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushPromises, shallowMount } from '@vue/test-utils';

import type { IProviderCardAction, IProviderCardLine, IProviderCardMenuItem, IRemoteAccessProvider } from '../../../modules/remote-access';
import {
	RemoteAccessModuleEndpointScope,
	RemoteAccessModuleProviderKind,
	RemoteAccessModuleProviderState,
	UsersModuleUserRole,
} from '../../../openapi.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import type { ITailscaleControl } from '../store/tailscale-status.store.types';

import TailscaleProviderCard from './tailscale-provider-card.vue';

// Only the mock functions themselves are hoisted - mirrors tailscale-setup-wizard.spec.ts.
const fns = vi.hoisted(() => ({
	fetchStatus: vi.fn(),
	fetchRemoteAccessStatus: vi.fn(),
	connect: vi.fn(),
	disconnect: vi.fn(),
	refreshStatus: vi.fn(),
	logout: vi.fn(),
	resetPreferences: vi.fn(),
	copy: vi.fn(),
	fetchExtension: vi.fn(),
	flashSuccess: vi.fn(),
	flashError: vi.fn(),
}));

const profile = ref<{ role: UsersModuleUserRole } | null>(null);
const status = ref<{ control?: ITailscaleControl; advisories: { code: string; message: string }[]; setup?: { state: string } | null } | null>(null);
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
	useExtension: () => ({ extension, isLoading: computed(() => false), fetchExtension: fns.fetchExtension }),
}));

vi.mock('../../../modules/remote-access', () => ({
	useRemoteAccessStatus: () => ({ fetchStatus: fns.fetchRemoteAccessStatus }),
	ProviderCard: {
		name: 'ProviderCard',
		props: ['icon', 'title', 'status', 'statusLabel', 'line', 'endpoints', 'action', 'menu'],
		emits: ['action'],
		template: '<div />',
	},
	providerStateStatus: (state: string) => state,
}));

vi.mock('../composables', () => ({
	useTailscaleStatus: () => ({
		status,
		requirements,
		isLoading: computed(() => false),
		isLoggingOut,
		isResettingPreferences,
		fetchStatus: fns.fetchStatus,
		refreshStatus: fns.refreshStatus,
		connect: fns.connect,
		disconnect: fns.disconnect,
		isConnecting: isActingReturn,
		isDisconnecting: isActingReturn,
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

const mountCard = (provider: Partial<IRemoteAccessProvider>) => {
	const state = provider.state ?? baseProvider.state;
	status.value = {
		...(status.value ?? { advisories: [] }),
		control: {
			enabled: true,
			serviceState: state === 'connected' ? 'started' : 'stopped',
			authentication: 'authenticated',
			operation: null,
			availableActions:
				state === 'connected'
					? ['disconnect', 'logout', 'reset-preferences']
					: state === 'disconnected' || state === 'error'
						? ['connect', 'logout', 'reset-preferences']
						: [],
		} as ITailscaleControl,
	};
	return shallowMount(TailscaleProviderCard, {
		props: { provider: { ...baseProvider, ...provider } },
	});
};

type CardWrapper = ReturnType<typeof mountCard>;

// The card renders through the module's provider card: its props are what the card shows
const card = (wrapper: CardWrapper) => wrapper.findComponent({ name: 'ProviderCard' });
const cardAction = (wrapper: CardWrapper): IProviderCardAction | null => card(wrapper).props('action') as IProviderCardAction | null;
const menuKeys = (wrapper: CardWrapper): string[] => ((card(wrapper).props('menu') ?? []) as IProviderCardMenuItem[]).map((item) => item.key);
const cardLine = (wrapper: CardWrapper): IProviderCardLine => card(wrapper).props('line') as IProviderCardLine;
const choose = async (wrapper: CardWrapper, key: string): Promise<void> => {
	card(wrapper).vm.$emit('action', key);
	await flushPromises();
};
const runPrimary = (wrapper: CardWrapper): Promise<void> => choose(wrapper, cardAction(wrapper)!.key);

describe('TailscaleProviderCard', () => {
	beforeEach(() => {
		profile.value = { role: UsersModuleUserRole.owner };
		status.value = null;
		requirements.value = [];
		isLoggingOut.value = false;
		isResettingPreferences.value = false;
		isActingReturn.value = false;
		extension.value = null;
		fns.fetchExtension.mockReset();
		fns.fetchStatus.mockReset().mockResolvedValue(undefined);
		fns.fetchRemoteAccessStatus.mockReset().mockResolvedValue(undefined);
		fns.refreshStatus.mockReset().mockResolvedValue(undefined);
		fns.connect.mockReset().mockResolvedValue(true);
		fns.disconnect.mockReset().mockResolvedValue(true);
		fns.logout.mockReset();
		fns.resetPreferences.mockReset();
		fns.copy.mockReset().mockResolvedValue(true);
		fns.flashSuccess.mockReset();
		fns.flashError.mockReset();
	});

	it.each(['https://smart-panel.fastybird.com/docs', 'http://panel.example.test/docs'])(
		'opens the platform documentation remedy without loading extension metadata (%s)',
		async (url) => {
			requirements.value = [{ code: 'platform-supported', satisfied: false, message: 'Unsupported platform.', remedy: { commands: [], note: url } }];
			const open = vi.spyOn(window, 'open').mockImplementation(() => null);
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.unsupported });

			try {
				expect(menuKeys(wrapper)).toContain('documentation');
				await choose(wrapper, 'documentation');
				expect(open).toHaveBeenCalledWith(url, '_blank', 'noopener,noreferrer');
				expect(fns.fetchExtension).not.toHaveBeenCalled();
			} finally {
				open.mockRestore();
				wrapper.unmount();
			}
		}
	);

	it('prefers loaded extension documentation over the platform remedy', async () => {
		extension.value = { links: { documentation: 'https://panel.example.test/provider' } };
		requirements.value = [
			{
				code: 'platform-supported',
				satisfied: false,
				message: 'Unsupported platform.',
				remedy: { commands: [], note: 'https://panel.example.test/fallback' },
			},
		];
		const open = vi.spyOn(window, 'open').mockImplementation(() => null);
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.unsupported });

		try {
			await choose(wrapper, 'documentation');
			expect(open).toHaveBeenCalledWith('https://panel.example.test/provider', '_blank', 'noopener,noreferrer');
		} finally {
			open.mockRestore();
			wrapper.unmount();
		}
	});

	it.each(['javascript:alert(1)', 'data:text/html,test', '/docs', 'Read the documentation', null])(
		'hides documentation when the platform remedy is not an absolute HTTP(S) URL (%s)',
		(note) => {
			requirements.value = [{ code: 'platform-supported', satisfied: false, message: 'Unsupported platform.', remedy: { commands: [], note } }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.unsupported });

			expect(menuKeys(wrapper)).not.toContain('documentation');
			wrapper.unmount();
		}
	);

	it('offers setup as the primary action for an owner on a fresh node, with no secondary actions', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

		expect(cardAction(wrapper)).toMatchObject({ key: 'setup', label: 'remoteAccessTailscalePlugin.buttons.setup', primary: true });
		expect(menuKeys(wrapper)).toEqual([]);
	});

	it('clicking the main button runs the primary action', async () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });

		await runPrimary(wrapper);

		expect(fns.connect).toHaveBeenCalledWith();
	});

	it('offers connect as the primary action, and the owner-only actions as secondary, for a disconnected node with a tailnet', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });

		expect(cardAction(wrapper)).toMatchObject({ key: 'connect', label: 'remoteAccessTailscalePlugin.buttons.connect', primary: false });
		expect(menuKeys(wrapper)).toEqual(['signOut', 'resetPreferences']);
	});

	it('offers disconnect as the primary action and the owner-only actions as secondary for a connected node', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

		expect(cardAction(wrapper)).toMatchObject({ key: 'disconnect', label: 'remoteAccessTailscalePlugin.buttons.disconnect', primary: false });
		expect(menuKeys(wrapper)).toEqual(['signOut', 'resetPreferences']);
	});

	it('offers no action when the viewer is not the owner and no self-service action applies', () => {
		profile.value = { role: UsersModuleUserRole.user };

		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

		expect(cardAction(wrapper)).toBeNull();
		expect(menuKeys(wrapper)).toEqual([]);
	});

	it('shows the published endpoints, HTTPS first', () => {
		const wrapper = mountCard({
			state: RemoteAccessModuleProviderState.connected,
			endpoints: [
				{ url: 'http://100.64.0.1:3000', scope: RemoteAccessModuleEndpointScope.private, https: false, label: 'Tailscale' },
				{ url: 'https://node.tailnet.ts.net', scope: RemoteAccessModuleEndpointScope.private, https: true, label: 'Tailscale (HTTPS)' },
			],
		});

		expect(card(wrapper).props('endpoints')).toEqual(['https://node.tailnet.ts.net', 'http://100.64.0.1:3000']);
	});

	it("shows the node's name and address while no endpoint is published", () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected, endpoints: [], details: { dnsName: 'node.tailnet.ts.net', ipv4: '100.64.0.1' } });

		expect(card(wrapper).props('endpoints')).toEqual(['node.tailnet.ts.net', '100.64.0.1']);
	});

	it('reads the provider state as a status tag and describes the provider while nothing is wrong', () => {
		const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

		expect(card(wrapper).props('status')).toBe('connected');
		expect(card(wrapper).props('statusLabel')).toBe('remoteAccessModule.status.connected');
		expect(cardLine(wrapper)).toEqual({ text: 'remoteAccessTailscalePlugin.texts.cardDescription' });
	});

	describe('refetch after connection actions (F1)', () => {
		it('refetches both the plugin and the module status once connect resolves successfully', async () => {
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await runPrimary(wrapper);

			expect(fns.connect).toHaveBeenCalled();
			expect(fns.refreshStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('still refetches both statuses when connect reports failure', async () => {
			fns.connect.mockRejectedValue(new Error('connection failed'));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'example.ts.net' } });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await runPrimary(wrapper);

			expect(fns.refreshStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('refetches both statuses once disconnect resolves', async () => {
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await runPrimary(wrapper);

			expect(fns.disconnect).toHaveBeenCalled();
			expect(fns.refreshStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('still refetches both statuses when disconnect reports failure', async () => {
			fns.disconnect.mockRejectedValue(new Error('connection failed'));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await runPrimary(wrapper);

			expect(fns.refreshStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('refetches both statuses once connect from error resolves', async () => {
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.error });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await runPrimary(wrapper);

			expect(fns.connect).toHaveBeenCalled();
			expect(fns.refreshStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});

		it('still refetches both statuses when connect from error fails', async () => {
			fns.connect.mockRejectedValue(new Error('connection failed'));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.error });
			fns.fetchStatus.mockClear();
			fns.fetchRemoteAccessStatus.mockClear();

			await runPrimary(wrapper);

			expect(fns.refreshStatus).toHaveBeenCalled();
			expect(fns.fetchRemoteAccessStatus).toHaveBeenCalled();
		});
	});

	describe('D12: "Cannot be used yet" line', () => {
		it('names the first unsatisfied requirement while setup-required', () => {
			requirements.value = [
				{ code: 'binary-installed', satisfied: true, message: 'Tailscale is installed.', remedy: null },
				{ code: 'daemon-active', satisfied: false, message: 'tailscaled is not active.', remedy: null },
			];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			expect(cardLine(wrapper)).toEqual({ text: 'remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle: tailscaled is not active.', status: 'warn' });
		});

		it('names the first unsatisfied requirement while not-installed', () => {
			requirements.value = [{ code: 'binary-installed', satisfied: false, message: 'Tailscale is not installed.', remedy: null }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.not_installed });

			expect(cardLine(wrapper)).toEqual({ text: 'remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle: Tailscale is not installed.', status: 'warn' });
		});

		it('does not say so once every requirement is satisfied', () => {
			requirements.value = [{ code: 'binary-installed', satisfied: true, message: 'x', remedy: null }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			expect(cardLine(wrapper).text).not.toContain('remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle');
		});

		it('does not say so for a normal, non-blocked state', () => {
			requirements.value = [{ code: 'daemon-active', satisfied: false, message: 'x', remedy: null }];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.disconnected, details: { tailnet: 'x' } });

			expect(cardLine(wrapper).text).not.toContain('remoteAccessTailscalePlugin.texts.cannotBeUsedYetTitle');
		});
	});

	describe('D12: operator-not-granted advisory', () => {
		it('shows the advisory text and offers the operator-grant command in the menu', () => {
			status.value = { advisories: [{ code: 'operator-not-granted', message: 'The smart-panel operator has not been granted.' }] };
			requirements.value = [
				{ code: 'operator-granted', satisfied: false, message: 'x', remedy: { commands: ['sudo tailscale set --operator=smart-panel'], note: null } },
			];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			expect(cardLine(wrapper)).toEqual({ text: 'The smart-panel operator has not been granted.', status: 'danger' });
			expect(menuKeys(wrapper)).toContain('copyGrantCommand');
		});

		it('copies the operator-grant command via the shared clipboard composable', async () => {
			status.value = { advisories: [{ code: 'operator-not-granted', message: 'x' }] };
			requirements.value = [
				{ code: 'operator-granted', satisfied: false, message: 'x', remedy: { commands: ['sudo tailscale set --operator=smart-panel'], note: null } },
			];
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.setup_required });

			await choose(wrapper, 'copyGrantCommand');

			expect(fns.copy).toHaveBeenCalledWith('sudo tailscale set --operator=smart-panel');
			expect(fns.flashSuccess).toHaveBeenCalledWith('remoteAccessTailscalePlugin.messages.commandCopied');
		});

		it('offers no operator-grant command when there is no operator-not-granted advisory', () => {
			status.value = { advisories: [] };
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			expect(menuKeys(wrapper)).not.toContain('copyGrantCommand');
		});
	});

	describe('D13: action error hints', () => {
		it('shows a recovery hint after sign-out fails with a known error code', async () => {
			fns.logout.mockRejectedValue(
				new RemoteAccessTailscaleApiException('The smart-panel operator has not been granted.', 409, null, 'operator-not-granted')
			);
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await choose(wrapper, 'signOut');

			expect(cardLine(wrapper)).toEqual({ text: 'remoteAccessTailscalePlugin.errors.operatorNotGranted', status: 'warn' });
		});

		it('shows a recovery hint after reset-preferences fails with a known error code', async () => {
			fns.resetPreferences.mockRejectedValue(new RemoteAccessTailscaleApiException('The daemon is not running.', 409, null, 'daemon-not-active'));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await choose(wrapper, 'resetPreferences');

			expect(cardLine(wrapper)).toEqual({ text: 'remoteAccessTailscalePlugin.errors.daemonNotActive', status: 'warn' });
		});

		it('shows no hint for an unrecognised or absent error code', async () => {
			fns.logout.mockRejectedValue(new RemoteAccessTailscaleApiException('Internal error detail', 500));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await choose(wrapper, 'signOut');

			expect(cardLine(wrapper).text).not.toMatch(/^remoteAccessTailscalePlugin\.errors\./);
		});

		it('shows the backend reason as a toast for a 409 sign-out failure', async () => {
			fns.logout.mockRejectedValue(new RemoteAccessTailscaleApiException('A prerequisite is not satisfied.', 409));
			const wrapper = mountCard({ state: RemoteAccessModuleProviderState.connected });

			await choose(wrapper, 'signOut');

			expect(fns.flashError).toHaveBeenCalledWith('A prerequisite is not satisfied.');
		});
	});
});
