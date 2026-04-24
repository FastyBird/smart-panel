import { ApplicationConfig } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { DisplayAwareThrottlerGuard } from '../src/modules/auth/guards/display-aware-throttler.guard';
import { RolesGuard } from '../src/modules/users/guards/roles.guard';

/**
 * Regression test that pins the runtime order of `APP_GUARD` providers.
 *
 * The order is load-bearing for security:
 *   1. `DisplayAwareThrottlerGuard` runs FIRST so anonymous floods to
 *      protected endpoints stay rate-limited (otherwise `AuthGuard`
 *      would 401 them and the throttler would never count the request).
 *   2. `AuthGuard` runs SECOND to populate `request.auth` from the
 *      bearer token.
 *   3. `RolesGuard` runs THIRD to read `request.auth?.role` against the
 *      `@Roles()` metadata.
 *
 * Reordering ANY of these breaks security or breaks every
 * `@Roles()`-protected endpoint with a 403. NestJS resolves global
 * guards in `applicationProvidersApplyMap` order, which equals the
 * preorder DFS of the module graph from the root — so `AppModule`'s
 * own `APP_GUARD` providers are emitted before any imported module's
 * providers (e.g. `RolesGuard` registered in `UsersModule`). This
 * test asserts that contract directly so a future module reorganisation
 * can't silently break it.
 */
describe('Global APP_GUARD execution order', () => {
	it('is DisplayAwareThrottlerGuard → AuthGuard → RolesGuard', async () => {
		const dynamicAppModule = AppModule.register({ moduleExtensions: [], pluginExtensions: [] });
		const moduleFixture = await Test.createTestingModule({ imports: [dynamicAppModule] }).compile();
		const app = moduleFixture.createNestApplication();
		await app.init();

		const config = app.get(ApplicationConfig, { strict: false });
		const guards = config.getGlobalGuards();

		const throttlerIdx = guards.findIndex((g) => g instanceof DisplayAwareThrottlerGuard);
		const authIdx = guards.findIndex((g) => g instanceof AuthGuard);
		const rolesIdx = guards.findIndex((g) => g instanceof RolesGuard);

		expect(throttlerIdx).toBeGreaterThanOrEqual(0);
		expect(authIdx).toBeGreaterThanOrEqual(0);
		expect(rolesIdx).toBeGreaterThanOrEqual(0);

		// Throttler must run before AuthGuard so unauthenticated floods
		// to protected endpoints don't bypass rate-limiting via 401.
		expect(throttlerIdx).toBeLessThan(authIdx);
		// AuthGuard must run before RolesGuard so `request.auth` is
		// populated by the time `RolesGuard` reads `auth?.role`.
		expect(authIdx).toBeLessThan(rolesIdx);

		await app.close();
	});
});
