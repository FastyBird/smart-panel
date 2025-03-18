import { createApp } from 'vue';
import type { RouteRecordRaw } from 'vue-router';

import { beforeEach, describe, expect, it } from 'vitest';

import { RouterGuards, injectRouterGuard, provideRouterGuards, routerGuardKey } from './router-guards';

describe('RouterGuards', () => {
	let routerGuards: RouterGuards;
	let mockRoute: RouteRecordRaw;

	beforeEach(() => {
		routerGuards = new RouterGuards();
		mockRoute = { path: '/test' } as RouteRecordRaw;
	});

	it('should allow access when no guards are registered', () => {
		expect(routerGuards.handle(undefined, mockRoute)).toBe(true);
	});

	it('should allow access when all guards return true', () => {
		routerGuards.register(() => true);
		routerGuards.register(() => true);

		expect(routerGuards.handle(undefined, mockRoute)).toBe(true);
	});

	it('should deny access if a guard returns false', () => {
		routerGuards.register(() => true);
		routerGuards.register(() => false);
		routerGuards.register(() => true); // Should not be reached

		expect(routerGuards.handle(undefined, mockRoute)).toBe(false);
	});

	it('should return the first non-true value from guards', () => {
		routerGuards.register(() => true);
		routerGuards.register(() => '/redirect');
		routerGuards.register(() => false); // Should not be reached

		expect(routerGuards.handle(undefined, mockRoute)).toBe('/redirect');
	});

	it('should inject and provide router guards properly', () => {
		const app = createApp({});
		provideRouterGuards(app, routerGuards);

		expect(app._context.provides[routerGuardKey]).toBe(routerGuards);
		expect(injectRouterGuard(app)).toBe(routerGuards);
	});

	it('should throw an error if router guard is not provided', () => {
		expect(() => injectRouterGuard()).toThrowError('A router guard has not been provided.');
	});
});
