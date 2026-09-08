import { describe, expect, it, vi } from 'vitest';

import type { RemoteAccessModuleProviderState } from '../../../openapi.constants';
import { RemoteAccessCloudflareTunnelApiException } from '../remote-access-cloudflare-tunnel.exceptions';
import type { ICloudflareTunnelRequirement } from '../store/cloudflare-tunnel-status.store.types';

import {
	buildCloudflareTunnelRemedyPlan,
	findFirstUnsatisfiedRequirement,
	flashCloudflareTunnelApiError,
	isCloudflareTunnelUnusableState,
	resolveCloudflareTunnelErrorHintKey,
	resolveCloudflareTunnelProviderActions,
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

describe('resolveCloudflareTunnelProviderActions', () => {
	it.each(ALL_STATES)('offers setup to an owner only for not-installed (state: %s)', (state) => {
		const actions = resolveCloudflareTunnelProviderActions({ state, isOwner: true });

		expect(actions.setup).toBe(state === 'not-installed');
	});

	it.each(ALL_STATES)('never offers setup to a non-owner because `POST /install` is owner-only (state: %s)', (state) => {
		const actions = resolveCloudflareTunnelProviderActions({ state, isOwner: false });

		expect(actions.setup).toBe(false);
	});

	it.each(ALL_STATES)('offers configure to an owner only for setup-required (state: %s)', (state) => {
		const actions = resolveCloudflareTunnelProviderActions({ state, isOwner: true });

		expect(actions.configure).toBe(state === 'setup-required');
	});

	it.each(ALL_STATES)('never offers configure to a non-owner (state: %s)', (state) => {
		const actions = resolveCloudflareTunnelProviderActions({ state, isOwner: false });

		expect(actions.configure).toBe(false);
	});

	it('offers connect only while disconnected', () => {
		expect(resolveCloudflareTunnelProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, isOwner: false }).connect).toBe(true);
		expect(resolveCloudflareTunnelProviderActions({ state: 'connected' as RemoteAccessModuleProviderState, isOwner: false }).connect).toBe(false);
	});

	it('offers disconnect while connected or connecting', () => {
		expect(resolveCloudflareTunnelProviderActions({ state: 'connected' as RemoteAccessModuleProviderState, isOwner: false }).disconnect).toBe(true);
		expect(resolveCloudflareTunnelProviderActions({ state: 'connecting' as RemoteAccessModuleProviderState, isOwner: false }).disconnect).toBe(true);
		expect(resolveCloudflareTunnelProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, isOwner: false }).disconnect).toBe(
			false
		);
	});

	it('offers reconnect while connected or on error, not while disconnected', () => {
		expect(resolveCloudflareTunnelProviderActions({ state: 'connected' as RemoteAccessModuleProviderState, isOwner: false }).reconnect).toBe(true);
		expect(resolveCloudflareTunnelProviderActions({ state: 'error' as RemoteAccessModuleProviderState, isOwner: false }).reconnect).toBe(true);
		expect(resolveCloudflareTunnelProviderActions({ state: 'disconnected' as RemoteAccessModuleProviderState, isOwner: false }).reconnect).toBe(
			false
		);
	});

	it('offers nothing at all for an unsupported platform to a non-owner', () => {
		const actions = resolveCloudflareTunnelProviderActions({ state: 'unsupported' as RemoteAccessModuleProviderState, isOwner: false });

		expect(actions).toEqual({
			setup: false,
			configure: false,
			connect: false,
			disconnect: false,
			reconnect: false,
			remove: false,
		});
	});

	describe('remove (owner-only, mirrors POST /reset)', () => {
		it.each(['not-installed', 'unsupported'] as RemoteAccessModuleProviderState[])(
			'hides remove from an owner while the platform/binary prerequisites are unmet (state: %s)',
			(state) => {
				expect(resolveCloudflareTunnelProviderActions({ state, isOwner: true }).remove).toBe(false);
			}
		);

		it.each(['setup-required', 'connecting', 'connected', 'disconnected', 'error'] as RemoteAccessModuleProviderState[])(
			'offers remove to an owner once the platform/binary prerequisites are met (state: %s)',
			(state) => {
				expect(resolveCloudflareTunnelProviderActions({ state, isOwner: true }).remove).toBe(true);
			}
		);

		it('hides remove from a non-owner even once the prerequisites are met', () => {
			expect(resolveCloudflareTunnelProviderActions({ state: 'connected' as RemoteAccessModuleProviderState, isOwner: false }).remove).toBe(false);
		});
	});
});

describe('isCloudflareTunnelUnusableState', () => {
	it.each(['not-installed', 'setup-required'] as RemoteAccessModuleProviderState[])('is true for %s', (state) => {
		expect(isCloudflareTunnelUnusableState(state)).toBe(true);
	});

	it.each(['connecting', 'connected', 'disconnected', 'error', 'unsupported'] as RemoteAccessModuleProviderState[])('is false for %s', (state) => {
		expect(isCloudflareTunnelUnusableState(state)).toBe(false);
	});
});

describe('findFirstUnsatisfiedRequirement', () => {
	const requirement = (code: string, satisfied: boolean): ICloudflareTunnelRequirement =>
		({ code, satisfied, message: `${code} message`, remedy: null }) as unknown as ICloudflareTunnelRequirement;

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

describe('buildCloudflareTunnelRemedyPlan', () => {
	it('concatenates commands from every unsatisfied requirement, in order', () => {
		const requirements = [
			{ code: 'binary-installed', satisfied: false, message: 'x', remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null } },
			{ code: 'token-configured', satisfied: false, message: 'x', remedy: { commands: [], note: 'Paste the tunnel token in the setup wizard' } },
		] as unknown as ICloudflareTunnelRequirement[];

		expect(buildCloudflareTunnelRemedyPlan(requirements)).toEqual({
			commands: ['sudo apt-get install -y cloudflared'],
			notes: ['Paste the tunnel token in the setup wizard'],
		});
	});

	it('ignores a satisfied requirement even if it still carries a remedy', () => {
		const requirements = [
			{ code: 'binary-installed', satisfied: true, message: 'x', remedy: { commands: ['sudo apt-get install -y cloudflared'], note: null } },
		] as unknown as ICloudflareTunnelRequirement[];

		expect(buildCloudflareTunnelRemedyPlan(requirements)).toEqual({ commands: [], notes: [] });
	});

	it('ignores a requirement with no remedy at all', () => {
		const requirements = [{ code: 'platform-supported', satisfied: false, message: 'x', remedy: null }] as unknown as ICloudflareTunnelRequirement[];

		expect(buildCloudflareTunnelRemedyPlan(requirements)).toEqual({ commands: [], notes: [] });
	});

	it('returns an empty plan for an empty requirements list', () => {
		expect(buildCloudflareTunnelRemedyPlan([])).toEqual({ commands: [], notes: [] });
	});
});

describe('resolveCloudflareTunnelErrorHintKey', () => {
	it.each([
		['privileged-worker-unavailable', 'remoteAccessCloudflareTunnelPlugin.errors.privilegedWorkerUnavailable'],
		['platform-unsupported', 'remoteAccessCloudflareTunnelPlugin.errors.platformUnsupported'],
	])('maps %s to %s', (code, expectedKey) => {
		expect(resolveCloudflareTunnelErrorHintKey(code)).toBe(expectedKey);
	});

	it('returns null for an unrecognised code', () => {
		expect(resolveCloudflareTunnelErrorHintKey('token-configured')).toBeNull();
	});

	it('returns null for a null code', () => {
		expect(resolveCloudflareTunnelErrorHintKey(null)).toBeNull();
	});
});

describe('flashCloudflareTunnelApiError', () => {
	it('shows the backend reason for a meaningful status code', () => {
		const flashError = vi.fn();
		const error = new RemoteAccessCloudflareTunnelApiException('Cloudflare Tunnel setup is unavailable on this platform.', 422);

		flashCloudflareTunnelApiError(error, [422], 'fallback', flashError);

		expect(flashError).toHaveBeenCalledWith('Cloudflare Tunnel setup is unavailable on this platform.');
	});

	it('falls back to the generic message for an unlisted status code', () => {
		const flashError = vi.fn();
		const error = new RemoteAccessCloudflareTunnelApiException('Internal error detail', 500);

		flashCloudflareTunnelApiError(error, [422], 'fallback', flashError);

		expect(flashError).toHaveBeenCalledWith('fallback');
	});

	it('falls back to the generic message for a non-API error', () => {
		const flashError = vi.fn();

		flashCloudflareTunnelApiError(new Error('network blip'), [422], 'fallback', flashError);

		expect(flashError).toHaveBeenCalledWith('fallback');
	});
});
