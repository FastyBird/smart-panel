import { describe, expect, it, vi } from 'vitest';

import {
	ExtensionsModuleServiceState,
	type RemoteAccessModuleProviderState,
	RemoteAccessTailscalePluginAuthentication,
	RemoteAccessTailscalePluginControlAction,
} from '../../../openapi.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import type { ITailscaleControl, ITailscaleRequirement } from '../store/tailscale-status.store.types';

import {
	buildTailscaleRemedyPlan,
	findFirstUnsatisfiedRequirement,
	findOperatorGrantCommand,
	flashTailscaleApiError,
	isTailscaleUnusableState,
	resolveTailscaleErrorHintKey,
	resolveTailscaleProviderActions,
} from './provider-actions';

const ALL_STATES: RemoteAccessModuleProviderState[] = [
	'unsupported',
	'not-installed',
	'setup-required',
	'pending-auth',
	'pending-approval',
	'connecting',
	'connected',
	'disconnected',
	'error',
] as RemoteAccessModuleProviderState[];

const control = (availableActions: ITailscaleControl['availableActions'], overrides: Partial<ITailscaleControl> = {}): ITailscaleControl => ({
	enabled: true,
	serviceState: ExtensionsModuleServiceState.stopped,
	authentication: RemoteAccessTailscalePluginAuthentication.authenticated,
	operation: null,
	availableActions,
	...overrides,
});

describe('resolveTailscaleProviderActions', () => {
	it.each(ALL_STATES)('fails closed without a control snapshot (%s)', (state) => {
		expect(Object.values(resolveTailscaleProviderActions({ state, isOwner: true, isAdmin: false }))).not.toContain(true);
	});

	it.each([ExtensionsModuleServiceState.stopped, ExtensionsModuleServiceState.started])(
		'offers the explicit connect action for authenticated disconnected nodes (%s)',
		(serviceState) => {
			const actions = resolveTailscaleProviderActions({
				state: 'disconnected' as RemoteAccessModuleProviderState,
				control: control([RemoteAccessTailscalePluginControlAction.connect], { serviceState }),
				isOwner: false,
				isAdmin: true,
			});
			expect(actions.connect).toBe(true);
			expect(actions.signIn).toBe(false);
		}
	);

	it('offers sign-in only when the backend permits it', () => {
		const actions = resolveTailscaleProviderActions({
			state: 'disconnected' as RemoteAccessModuleProviderState,
			control: control([RemoteAccessTailscalePluginControlAction.login], { authentication: RemoteAccessTailscalePluginAuthentication.required }),
			isOwner: false,
			isAdmin: true,
		});
		expect(actions.signIn).toBe(true);
		expect(actions.connect).toBe(false);
	});

	it('keeps backend cancellation available during login', () => {
		const actions = resolveTailscaleProviderActions({
			state: 'pending-auth' as RemoteAccessModuleProviderState,
			control: control([RemoteAccessTailscalePluginControlAction.disconnect], { operation: 'login' as ITailscaleControl['operation'] }),
			isOwner: false,
			isAdmin: true,
		});
		expect(actions.disconnect).toBe(true);
		expect(actions.signIn).toBe(false);
	});

	it('restricts owner actions even when an inconsistent response includes them for an admin', () => {
		const actions = resolveTailscaleProviderActions({
			state: 'connected' as RemoteAccessModuleProviderState,
			control: control([
				RemoteAccessTailscalePluginControlAction.disconnect,
				RemoteAccessTailscalePluginControlAction.logout,
				RemoteAccessTailscalePluginControlAction.reset_preferences,
			]),
			isOwner: false,
			isAdmin: true,
		});
		expect(actions.disconnect).toBe(true);
		expect(actions.signOut).toBe(false);
		expect(actions.resetPreferences).toBe(false);
	});

	it('hides all controls for a regular user even if available_actions is inconsistent', () => {
		const actions = resolveTailscaleProviderActions({
			state: 'disconnected' as RemoteAccessModuleProviderState,
			control: control([RemoteAccessTailscalePluginControlAction.connect, RemoteAccessTailscalePluginControlAction.login]),
			isOwner: false,
			isAdmin: false,
		});
		expect(Object.values(actions)).not.toContain(true);
	});

	it.each(ALL_STATES)('offers setup only to owners on an enabled idle node with unmet prerequisites (%s)', (state) => {
		expect(resolveTailscaleProviderActions({ state, control: control([]), isOwner: true, isAdmin: false }).setup).toBe(
			state === 'not-installed' || state === 'setup-required'
		);
		expect(resolveTailscaleProviderActions({ state, control: control([], { enabled: false }), isOwner: true, isAdmin: false }).setup).toBe(false);
	});
});

describe('isTailscaleUnusableState', () => {
	it.each(['not-installed', 'setup-required'] as RemoteAccessModuleProviderState[])('is true for %s', (state) => {
		expect(isTailscaleUnusableState(state)).toBe(true);
	});

	it.each([
		'pending-auth',
		'disconnected',
		'connected',
		'connecting',
		'error',
		'pending-approval',
		'unsupported',
	] as RemoteAccessModuleProviderState[])('is false for %s', (state) => {
		expect(isTailscaleUnusableState(state)).toBe(false);
	});
});

describe('findFirstUnsatisfiedRequirement', () => {
	const requirement = (code: string, satisfied: boolean): ITailscaleRequirement =>
		({ code, satisfied, message: `${code} message`, remedy: null }) as unknown as ITailscaleRequirement;

	it('returns null when every requirement is satisfied', () => {
		expect(findFirstUnsatisfiedRequirement([requirement('a', true), requirement('b', true)])).toBeNull();
	});

	it('returns the first unsatisfied requirement in array order', () => {
		const first = requirement('a', true);
		const second = requirement('b', false);
		const third = requirement('c', false);

		expect(findFirstUnsatisfiedRequirement([first, second, third])).toBe(second);
	});

	it('returns null for an empty requirements list', () => {
		expect(findFirstUnsatisfiedRequirement([])).toBeNull();
	});
});

describe('findOperatorGrantCommand', () => {
	it('returns the operator-granted requirement remedy command', () => {
		const requirements = [
			{ code: 'operator-granted', satisfied: false, message: 'x', remedy: { commands: ['sudo tailscale set --operator=smart-panel'], note: null } },
		] as unknown as ITailscaleRequirement[];

		expect(findOperatorGrantCommand(requirements)).toBe('sudo tailscale set --operator=smart-panel');
	});

	it('returns null when there is no operator-granted requirement', () => {
		expect(findOperatorGrantCommand([])).toBeNull();
	});

	it('returns null when the operator-granted requirement has no remedy', () => {
		const requirements = [{ code: 'operator-granted', satisfied: true, message: 'x', remedy: null }] as unknown as ITailscaleRequirement[];

		expect(findOperatorGrantCommand(requirements)).toBeNull();
	});
});

describe('buildTailscaleRemedyPlan', () => {
	it('concatenates commands from every unsatisfied requirement, in order', () => {
		const requirements = [
			{ code: 'daemon-active', satisfied: false, message: 'x', remedy: { commands: ['sudo systemctl enable --now tailscaled'], note: null } },
			{ code: 'operator-granted', satisfied: false, message: 'x', remedy: { commands: ['sudo tailscale set --operator=smart-panel'], note: null } },
		] as unknown as ITailscaleRequirement[];

		expect(buildTailscaleRemedyPlan(requirements)).toEqual({
			commands: ['sudo systemctl enable --now tailscaled', 'sudo tailscale set --operator=smart-panel'],
			notes: [],
		});
	});

	it('collects a note instead of a command when a remedy has none', () => {
		const requirements = [
			{ code: 'platform-supported', satisfied: false, message: 'x', remedy: { commands: [], note: 'https://tailscale.com/download' } },
		] as unknown as ITailscaleRequirement[];

		expect(buildTailscaleRemedyPlan(requirements)).toEqual({ commands: [], notes: ['https://tailscale.com/download'] });
	});

	it('ignores a satisfied requirement even if it still carries a remedy', () => {
		const requirements = [
			{ code: 'daemon-active', satisfied: true, message: 'x', remedy: { commands: ['sudo systemctl enable --now tailscaled'], note: null } },
		] as unknown as ITailscaleRequirement[];

		expect(buildTailscaleRemedyPlan(requirements)).toEqual({ commands: [], notes: [] });
	});

	it('ignores a requirement with no remedy at all', () => {
		const requirements = [{ code: 'daemon-active', satisfied: false, message: 'x', remedy: null }] as unknown as ITailscaleRequirement[];

		expect(buildTailscaleRemedyPlan(requirements)).toEqual({ commands: [], notes: [] });
	});

	it('returns an empty plan for an empty requirements list', () => {
		expect(buildTailscaleRemedyPlan([])).toEqual({ commands: [], notes: [] });
	});
});

describe('resolveTailscaleErrorHintKey', () => {
	it.each([
		['operator-not-granted', 'remoteAccessTailscalePlugin.errors.operatorNotGranted'],
		['daemon-not-active', 'remoteAccessTailscalePlugin.errors.daemonNotActive'],
		['not-signed-in', 'remoteAccessTailscalePlugin.errors.notSignedIn'],
		['privileged-worker-unavailable', 'remoteAccessTailscalePlugin.errors.privilegedWorkerUnavailable'],
		['platform-unsupported', 'remoteAccessTailscalePlugin.errors.platformUnsupported'],
	])('maps %s to %s', (code, expectedKey) => {
		expect(resolveTailscaleErrorHintKey(code)).toBe(expectedKey);
	});

	it('returns null for an unrecognised code', () => {
		expect(resolveTailscaleErrorHintKey('daemon-active')).toBeNull();
	});

	it('returns null for a null code', () => {
		expect(resolveTailscaleErrorHintKey(null)).toBeNull();
	});
});

describe('flashTailscaleApiError', () => {
	it('shows the backend reason for a meaningful status code', () => {
		const flashError = vi.fn();
		const error = new RemoteAccessTailscaleApiException('A Tailscale setup job is already running.', 409);

		flashTailscaleApiError(error, [409, 422], 'fallback', flashError);

		expect(flashError).toHaveBeenCalledWith('A Tailscale setup job is already running.');
	});

	it('falls back to the generic message for an unlisted status code', () => {
		const flashError = vi.fn();
		const error = new RemoteAccessTailscaleApiException('Internal error detail', 500);

		flashTailscaleApiError(error, [409, 422], 'fallback', flashError);

		expect(flashError).toHaveBeenCalledWith('fallback');
	});

	it('falls back to the generic message for a non-API error', () => {
		const flashError = vi.fn();

		flashTailscaleApiError(new Error('network blip'), [409, 422], 'fallback', flashError);

		expect(flashError).toHaveBeenCalledWith('fallback');
	});
});
