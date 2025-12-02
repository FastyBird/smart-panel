/*
eslint-disable vue/one-component-per-file
*/
import { createApp, hasInjectionContext, inject } from 'vue';

import type { Client } from 'openapi-fetch';
import { describe, expect, it, vi } from 'vitest';

import type { paths } from '../../openapi.constants';

import { backendKey, injectBackendClient, provideBackendClient } from './backend';

vi.mock('vue', async (importOriginal) => {
	const actual = await importOriginal<typeof import('vue')>();
	return {
		...actual,
		inject: vi.fn(actual.inject),
		hasInjectionContext: vi.fn(() => false),
	};
});

describe('Backend Service', () => {
	it('provides and injects backend client correctly', () => {
		const app = createApp({});
		const mockBackendClient = {} as Client<paths>; // Mock client

		// Provide backend client
		provideBackendClient(app, mockBackendClient);

		// Ensure the client is provided in Vue app context
		expect(app._context.provides[backendKey]).toBe(mockBackendClient);
	});

	it('injects backend client from app context', () => {
		const app = createApp({});
		const mockBackendClient = {} as Client<paths>;

		// Provide backend client
		provideBackendClient(app, mockBackendClient);

		// Inject backend client
		const injectedClient = injectBackendClient(app);

		expect(injectedClient).toBe(mockBackendClient);
	});

	it('injects backend client via Vue injection', () => {
		const mockBackendClient = {} as Client<paths>;

		vi.mocked(inject).mockReturnValue(mockBackendClient);
		vi.mocked(hasInjectionContext).mockReturnValue(true);

		expect(injectBackendClient()).toBe(mockBackendClient);
	});

	it('throws error if backend client is not provided', () => {
		vi.mocked(hasInjectionContext).mockReturnValue(false);

		expect(() => injectBackendClient()).toThrowError('A backend client has not been provided.');
	});

	it('throws error if backend client is not provided', () => {
		vi.mocked(inject).mockReturnValue(undefined);

		expect(() => injectBackendClient()).toThrowError('A backend client has not been provided.');
	});
});
