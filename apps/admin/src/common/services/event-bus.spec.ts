/*
eslint-disable vue/one-component-per-file
*/
import { createApp, hasInjectionContext, inject } from 'vue';

import type { Emitter } from 'mitt';
import { describe, expect, it, vi } from 'vitest';

import { type Events, eventBusKey, injectEventBus, provideEventBus } from './event-bus';

// Mock Vue inject functions
vi.mock('vue', async () => {
	const actual = await vi.importActual<typeof import('vue')>('vue');
	return {
		...actual,
		inject: vi.fn(),
		hasInjectionContext: vi.fn(),
	};
});

describe('Event Bus Service', () => {
	it('provides and injects event bus correctly', () => {
		const app = createApp({});
		const mockEventBus = {} as Emitter<Events>;

		// Provide event bus
		provideEventBus(app, mockEventBus);

		// Ensure the client is provided in Vue app context
		expect(app._context.provides[eventBusKey]).toBe(mockEventBus);
	});

	it('injects event bus from app context', () => {
		const app = createApp({});
		const mockEventBus = {} as Emitter<Events>;

		// Provide event bus
		provideEventBus(app, mockEventBus);

		// Inject event bus
		const injectedClient = injectEventBus(app);

		expect(injectedClient).toBe(mockEventBus);
	});

	it('injects event bus via Vue injection', () => {
		const mockEventBus = {} as Emitter<Events>;

		vi.mocked(inject).mockReturnValue(mockEventBus);
		vi.mocked(hasInjectionContext).mockReturnValue(true);

		expect(injectEventBus()).toBe(mockEventBus);
	});

	it('throws error if event bus is not provided', () => {
		vi.mocked(hasInjectionContext).mockReturnValue(false);

		expect(() => injectEventBus()).toThrowError('A event bus has not been provided.');
	});

	it('throws error if event bus is not provided', () => {
		vi.mocked(inject).mockReturnValue(undefined);

		expect(() => injectEventBus()).toThrowError('A event bus has not been provided.');
	});
});
