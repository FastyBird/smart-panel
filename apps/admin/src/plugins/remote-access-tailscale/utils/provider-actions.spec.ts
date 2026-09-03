import { describe, expect, it } from 'vitest';

import type { RemoteAccessModuleProviderState } from '../../../openapi.constants';

import { resolveTailscaleProviderActions } from './provider-actions';

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
	it.each(ALL_STATES)('offers setup only for not-installed/setup-required (state: %s)', (state) => {
		const actions = resolveTailscaleProviderActions({ state, hasTailnet: false, isOwner: false });

		expect(actions.setup).toBe(state === 'not-installed' || state === 'setup-required');
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
