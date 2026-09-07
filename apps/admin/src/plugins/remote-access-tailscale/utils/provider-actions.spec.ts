import { describe, expect, it, vi } from 'vitest';

import type { RemoteAccessModuleProviderState } from '../../../openapi.constants';
import { RemoteAccessTailscaleApiException } from '../remote-access-tailscale.exceptions';
import type { ITailscaleRequirement } from '../store/tailscale-status.store.types';

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

describe('resolveTailscaleProviderActions', () => {
	it.each(ALL_STATES)('offers setup to an owner only for not-installed/setup-required (state: %s)', (state) => {
		const actions = resolveTailscaleProviderActions({ state, hasTailnet: false, isOwner: true });

		expect(actions.setup).toBe(state === 'not-installed' || state === 'setup-required');
	});

	it.each(ALL_STATES)('never offers setup to a non-owner because `POST /install` is owner-only (state: %s)', (state) => {
		const actions = resolveTailscaleProviderActions({ state, hasTailnet: false, isOwner: false });

		expect(actions.setup).toBe(false);
	});

	it('offers sign-in while pending-auth', () => {
		const actions = resolveTailscaleProviderActions({ state: 'pending-auth' as RemoteAccessModuleProviderState, hasTailnet: false, isOwner: false });

		expect(actions.signIn).toBe(true);
		expect(actions.connect).toBe(false);
	});

	it('offers sign-in, not connect, for a disconnected node with no key', () => {
		const actions = resolveTailscaleProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, hasTailnet: false, isOwner: false });

		expect(actions.signIn).toBe(true);
		expect(actions.connect).toBe(false);
	});

	it('offers connect, not sign-in, for a disconnected node that already has a key (has a tailnet)', () => {
		const actions = resolveTailscaleProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, hasTailnet: true, isOwner: false });

		expect(actions.signIn).toBe(false);
		expect(actions.connect).toBe(true);
	});

	it('offers disconnect and reconnect while connected', () => {
		const actions = resolveTailscaleProviderActions({ state: 'connected' as RemoteAccessModuleProviderState, hasTailnet: true, isOwner: false });

		expect(actions.disconnect).toBe(true);
		expect(actions.reconnect).toBe(true);
		expect(actions.connect).toBe(false);
		expect(actions.setup).toBe(false);
		expect(actions.signIn).toBe(false);
	});

	it('offers disconnect (as an abort), not reconnect, while pending-approval', () => {
		const actions = resolveTailscaleProviderActions({
			state: 'pending-approval' as RemoteAccessModuleProviderState,
			hasTailnet: false,
			isOwner: false,
		});

		expect(actions.disconnect).toBe(true);
		expect(actions.reconnect).toBe(false);
	});

	it('offers reconnect, not disconnect, on an error state', () => {
		const actions = resolveTailscaleProviderActions({ state: 'error' as RemoteAccessModuleProviderState, hasTailnet: true, isOwner: false });

		expect(actions.reconnect).toBe(true);
		expect(actions.disconnect).toBe(false);
	});

	it('offers nothing at all for an unsupported platform', () => {
		const actions = resolveTailscaleProviderActions({ state: 'unsupported' as RemoteAccessModuleProviderState, hasTailnet: false, isOwner: true });

		expect(actions).toEqual({
			setup: false,
			signIn: false,
			connect: false,
			disconnect: false,
			reconnect: false,
			signOut: false,
			resetPreferences: false,
		});
	});

	describe('owner-only actions', () => {
		const keyedStates: RemoteAccessModuleProviderState[] = [
			'connected',
			'connecting',
			'pending-approval',
			'error',
		] as RemoteAccessModuleProviderState[];

		it.each(keyedStates)('offers sign-out and reset-preferences to an owner when a key exists (state: %s)', (state) => {
			const actions = resolveTailscaleProviderActions({ state, hasTailnet: true, isOwner: true });

			expect(actions.signOut).toBe(true);
			expect(actions.resetPreferences).toBe(true);
		});

		it.each(keyedStates)('hides sign-out and reset-preferences from a non-owner even when a key exists (state: %s)', (state) => {
			const actions = resolveTailscaleProviderActions({ state, hasTailnet: true, isOwner: false });

			expect(actions.signOut).toBe(false);
			expect(actions.resetPreferences).toBe(false);
		});

		it('hides sign-out and reset-preferences from an owner when there is no key yet', () => {
			const actions = resolveTailscaleProviderActions({
				state: 'setup-required' as RemoteAccessModuleProviderState,
				hasTailnet: false,
				isOwner: true,
			});

			expect(actions.signOut).toBe(false);
			expect(actions.resetPreferences).toBe(false);
		});

		it('offers sign-out and reset-preferences to an owner on a disconnected node with a key', () => {
			const actions = resolveTailscaleProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, hasTailnet: true, isOwner: true });

			expect(actions.signOut).toBe(true);
			expect(actions.resetPreferences).toBe(true);
		});

		it('hides sign-out and reset-preferences from an owner on a disconnected node with no key', () => {
			const actions = resolveTailscaleProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, hasTailnet: false, isOwner: true });

			expect(actions.signOut).toBe(false);
			expect(actions.resetPreferences).toBe(false);
		});
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
