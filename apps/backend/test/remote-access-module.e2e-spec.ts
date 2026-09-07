/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
*/
import request from 'supertest';

import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { TrustedProxyRegistryService } from '../src/modules/api/services/trusted-proxy-registry.service';
import { TokenOwnerType } from '../src/modules/auth/auth.constants';
import { AuthenticatedEntity, AuthenticatedRequest } from '../src/modules/auth/guards/auth.guard';
import { ConfigService } from '../src/modules/config/services/config.service';
import { RemoteAccessController } from '../src/modules/remote-access/controllers/remote-access.controller';
import {
	IRemoteAccessProvider,
	RemoteAccessProviderStatus,
} from '../src/modules/remote-access/platforms/remote-access-provider.platform';
import { EventType } from '../src/modules/remote-access/remote-access.constants';
import { RemoteAccessPostureService } from '../src/modules/remote-access/services/remote-access-posture.service';
import { RemoteAccessProviderRegistryService } from '../src/modules/remote-access/services/remote-access-provider-registry.service';
import { RemoteAccessProxyContributionService } from '../src/modules/remote-access/services/remote-access-proxy-contribution.service';
import { RemoteAccessStatusService } from '../src/modules/remote-access/services/remote-access-status.service';
import { RemoteAccessUrlService } from '../src/modules/remote-access/services/remote-access-url.service';
import { RolesGuard } from '../src/modules/users/guards/roles.guard';
import { UserRole } from '../src/modules/users/users.constants';

const TEST_CREDENTIALS: Record<string, AuthenticatedEntity> = {
	'owner-user': { type: 'user', id: 'owner-user', role: UserRole.OWNER },
	'admin-user': { type: 'user', id: 'admin-user', role: UserRole.ADMIN },
	'regular-user': { type: 'user', id: 'regular-user', role: UserRole.USER },
	'display-token': {
		type: 'token',
		tokenId: 'display-token',
		ownerType: TokenOwnerType.DISPLAY,
		ownerId: 'display-1',
		role: UserRole.USER,
	},
};

@Injectable()
class TestCredentialGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const credential = request.headers.authorization?.replace(/^Bearer /, '');
		const auth = credential ? TEST_CREDENTIALS[credential] : undefined;

		if (!auth) {
			throw new UnauthorizedException('Authentication required');
		}

		request.auth = auth;

		return true;
	}
}

const FAKE_PROVIDER_STATUS: RemoteAccessProviderStatus = {
	type: 'remote-access-fake',
	state: 'connected',
	endpoints: [{ url: 'https://fake.tailnet.ts.net', scope: 'private', https: true, label: 'Fake (HTTPS)' }],
	details: { fake: true },
	proxyAddresses: ['100.64.0.9'],
	advisories: [],
	updatedAt: '2025-01-18T12:00:00Z',
};

class FakeRemoteAccessProvider implements IRemoteAccessProvider {
	readonly type = 'remote-access-fake';
	readonly kind = 'mesh' as const;
	readonly capabilities = { https: true, publicUrl: false, identityHeaders: false, ssh: false };

	private status: RemoteAccessProviderStatus = FAKE_PROVIDER_STATUS;

	/**
	 * Lets a test drive this provider's status, mirroring a real managed
	 * service's own lifecycle transitions (e.g. `TailscaleNodeManagedService`
	 * reporting `disconnected` with no endpoints/proxyAddresses once its
	 * managed service is stopped — RA-18/D2/D3).
	 */
	setStatus(status: RemoteAccessProviderStatus): void {
		this.status = status;
	}

	getStatus(): Promise<RemoteAccessProviderStatus> {
		return Promise.resolve(this.status);
	}
}

/**
 * Exercises the four RA-2 module endpoints and their `@Roles(ADMIN, OWNER)`
 * gating end to end, with a fake provider registered into the real
 * `RemoteAccessProviderRegistryService` — the same lightweight
 * controller-slice pattern as `config-authorization.e2e-spec.ts`: the real
 * controller and real remote-access services, wired through a minimal
 * testing module rather than the full `AppModule`, with only `ConfigService`
 * faked (no config.yaml on disk is needed for this slice).
 */
describe('Remote access module endpoints (e2e)', () => {
	let app: INestApplication;
	let registry: RemoteAccessProviderRegistryService;
	let trustedProxyRegistry: TrustedProxyRegistryService;
	let eventEmitter: EventEmitter2;
	let fakeProvider: FakeRemoteAccessProvider;
	let fakeProviderEnabled = true;

	beforeAll(async () => {
		const configService = {
			getPluginConfig: jest.fn((type: string) => ({ type, enabled: fakeProviderEnabled })),
			getModuleConfig: jest.fn().mockReturnValue({
				type: 'remote-access-module',
				enabled: true,
				internalUrl: null,
				externalUrl: null,
				trustForwardedHeaders: false,
				trustedProxies: [],
			}),
		};
		const nestConfigService = {
			get: jest.fn((key: string) => ({ FB_APP_HOST: 'http://localhost', FB_BACKEND_PORT: 3000 })[key]),
		};

		const moduleFixture = await Test.createTestingModule({
			// A real EventEmitter2 (rather than the earlier bare `{ emit:
			// jest.fn() }` stand-in) so `RemoteAccessProxyContributionService`'s
			// `@OnEvent(PROVIDER_STATUS)` listener actually fires — needed to
			// exercise the trusted-proxy invalidation a real managed service's
			// `stop()`/`start()` now drives (RA-18/D3).
			imports: [EventEmitterModule.forRoot()],
			controllers: [RemoteAccessController],
			providers: [
				{ provide: APP_GUARD, useClass: TestCredentialGuard },
				{ provide: APP_GUARD, useClass: RolesGuard },
				{ provide: ConfigService, useValue: configService },
				{ provide: NestConfigService, useValue: nestConfigService },
				RemoteAccessProviderRegistryService,
				RemoteAccessStatusService,
				RemoteAccessUrlService,
				RemoteAccessPostureService,
				RemoteAccessProxyContributionService,
				TrustedProxyRegistryService,
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		registry = moduleFixture.get(RemoteAccessProviderRegistryService);
		trustedProxyRegistry = moduleFixture.get(TrustedProxyRegistryService);
		eventEmitter = moduleFixture.get(EventEmitter2);

		fakeProvider = new FakeRemoteAccessProvider();
		registry.register(fakeProvider);
	});

	afterAll(async () => {
		await app.close();
	});

	describe('GET /status', () => {
		it.each(['owner-user', 'admin-user'])('returns the aggregated status for %s', async (credential) => {
			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', `Bearer ${credential}`)
				.expect(200);

			expect(response.body.data).toMatchObject({
				enabled: true,
				providers: [expect.objectContaining({ type: 'remote-access-fake', state: 'connected' })],
				urls: expect.objectContaining({ internal: 'http://localhost:3000' }),
				advisories: expect.any(Array),
			});
		});

		it.each(['regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer()).get('/status').set('Authorization', `Bearer ${credential}`).expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).get('/status').expect(401);
		});
	});

	describe('GET /providers', () => {
		it('lists every registered provider for an admin', async () => {
			const response = await request(app.getHttpServer())
				.get('/providers')
				.set('Authorization', 'Bearer admin-user')
				.expect(200);

			expect(response.body.data).toEqual([expect.objectContaining({ type: 'remote-access-fake' })]);
		});

		it('denies a regular user', async () => {
			await request(app.getHttpServer()).get('/providers').set('Authorization', 'Bearer regular-user').expect(403);
		});
	});

	describe('GET /providers/:type', () => {
		it('returns the fake provider for an owner', async () => {
			const response = await request(app.getHttpServer())
				.get('/providers/remote-access-fake')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.body.data).toEqual(
				expect.objectContaining({
					type: 'remote-access-fake',
					proxyAddresses: ['100.64.0.9'],
				}),
			);
		});

		it('returns 404 for an unregistered provider type', async () => {
			await request(app.getHttpServer())
				.get('/providers/unknown-provider')
				.set('Authorization', 'Bearer admin-user')
				.expect(404);
		});

		it('denies a display token', async () => {
			await request(app.getHttpServer())
				.get('/providers/remote-access-fake')
				.set('Authorization', 'Bearer display-token')
				.expect(403);
		});
	});

	describe('GET /urls', () => {
		it('returns the URL registry for an admin', async () => {
			const response = await request(app.getHttpServer())
				.get('/urls')
				.set('Authorization', 'Bearer admin-user')
				.expect(200);

			expect(response.body.data).toMatchObject({
				internal: 'http://localhost:3000',
				candidates: expect.any(Array),
				external: expect.any(Array),
			});
		});

		it('denies a regular user', async () => {
			await request(app.getHttpServer()).get('/urls').set('Authorization', 'Bearer regular-user').expect(403);
		});
	});

	describe('disabled provider plugin', () => {
		beforeEach(() => {
			fakeProviderEnabled = false;
		});

		afterEach(() => {
			fakeProviderEnabled = true;
		});

		it('hides the provider from the aggregated status and the providers list', async () => {
			const status = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(status.body.data.providers).toEqual([]);

			const providers = await request(app.getHttpServer())
				.get('/providers')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(providers.body.data).toEqual([]);
		});
	});

	describe('provider reports disconnected (RA-18 — D2/D3: a stopped managed service reports disconnected with no endpoints/proxy addresses)', () => {
		afterEach(() => {
			// Restore the shared fake provider to its default connected fixture
			// for any test that runs after this one, and drop the resulting
			// PROVIDER_STATUS so RemoteAccessProxyContributionService's cache
			// does not stay invalidated to a stale computation either.
			fakeProvider.setStatus(FAKE_PROVIDER_STATUS);
			eventEmitter.emit(EventType.PROVIDER_STATUS, FAKE_PROVIDER_STATUS);
		});

		it('drops the endpoints from the aggregated status and stops trusting the previously-registered proxy address once the provider reports disconnected', async () => {
			// Baseline: connected, its endpoint is listed, and its proxy address
			// is trusted — exactly like "GET /status › returns the aggregated
			// status" and "GET /providers/:type › returns the fake provider for
			// an owner" above establish, plus the trusted-proxy side effect
			// those two don't check.
			const before = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(before.body.data.providers).toEqual([
				expect.objectContaining({
					type: 'remote-access-fake',
					state: 'connected',
					endpoints: FAKE_PROVIDER_STATUS.endpoints,
					proxyAddresses: ['100.64.0.9'],
				}),
			]);
			expect(trustedProxyRegistry.isTrusted('100.64.0.9')).toBe(true);

			// The provider now reports disconnected with no endpoints/proxy
			// addresses — exactly what `TailscaleNodeManagedService.stop()`
			// does once its managed service is stopped (RA-18), and it emits
			// PROVIDER_STATUS exactly as that real managed service now does on
			// every lifecycle transition.
			const disconnectedStatus: RemoteAccessProviderStatus = {
				...FAKE_PROVIDER_STATUS,
				state: 'disconnected',
				endpoints: [],
				proxyAddresses: [],
				message: 'The node service is stopped.',
			};
			fakeProvider.setStatus(disconnectedStatus);
			eventEmitter.emit(EventType.PROVIDER_STATUS, disconnectedStatus);

			const after = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(after.body.data.providers).toEqual([
				expect.objectContaining({
					type: 'remote-access-fake',
					state: 'disconnected',
					endpoints: [],
					proxyAddresses: [],
				}),
			]);
			expect(trustedProxyRegistry.isTrusted('100.64.0.9')).toBe(false);
		});
	});
});
