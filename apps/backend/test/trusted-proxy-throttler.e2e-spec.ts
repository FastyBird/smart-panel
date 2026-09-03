import request from 'supertest';

import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { AppModule } from '../src/app.module';

const STATUS_ROUTE = '/modules/displays/register/status';
const DEFAULT_THROTTLE_LIMIT = 30;

/**
 * `DisplayAwareThrottlerGuard.getTracker()` keys the default 30/60s budget
 * on `ClientAddressService`'s trust-aware resolution rather than the raw
 * socket address (RA-1). This is the end-to-end proof: two distinct
 * `X-Forwarded-For` clients behind one trusted proxy peer must not share a
 * bucket — otherwise every request behind a tunnel or reverse proxy would
 * throttle every other client behind it.
 *
 * Uses the Fastify adapter (like `main.ts`) rather than the default Express
 * test adapter so `ClientAddressService` resolves through the same
 * `request.raw.socket.remoteAddress` path production uses.
 */
describe('Trusted-proxy throttler bucket separation (e2e)', () => {
	let app: NestFastifyApplication;

	beforeAll(async () => {
		// `ApiModule` reads `FB_TRUSTED_PROXIES` lazily on every `isTrusted()`
		// call (see `TrustedProxyRegistryService`), but set it before the
		// module compiles anyway to match how every other env-driven e2e
		// fixture in this suite is set up. Supertest connects over the IPv4
		// loopback, so the peer `ClientAddressService` sees is 127.0.0.1.
		process.env.FB_TRUSTED_PROXIES = '127.0.0.1';

		const dynamicAppModule = AppModule.register({ moduleExtensions: [], pluginExtensions: [] });
		const moduleFixture = await Test.createTestingModule({ imports: [dynamicAppModule] }).compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		await app.listen(0, '127.0.0.1');
	});

	afterAll(async () => {
		delete process.env.FB_TRUSTED_PROXIES;
		await app.close();
	});

	it('gives two clients behind one trusted proxy separate throttler buckets', async () => {
		const server = app.getHttpServer();
		const clientA = '203.0.113.10';
		const clientB = '203.0.113.20';

		// Sanity check: the route itself works and isn't already throttled
		// (also catches a mis-typed path with a clear failure instead of a
		// wall of 429s below).
		const first = await request(server).get(STATUS_ROUTE).set('X-Forwarded-For', clientA);
		expect(first.status).toBe(200);

		// Drain client A's budget (1 request already spent above).
		for (let i = 1; i < DEFAULT_THROTTLE_LIMIT; i++) {
			const response = await request(server).get(STATUS_ROUTE).set('X-Forwarded-For', clientA);

			expect(response.status).toBe(200);
		}

		// Client A's bucket is now exhausted.
		const exhausted = await request(server).get(STATUS_ROUTE).set('X-Forwarded-For', clientA);
		expect(exhausted.status).toBe(429);

		// Client B, behind the same trusted proxy peer, has its own,
		// untouched budget — proving the two forwarded identities are
		// bucketed separately rather than sharing the proxy's one address.
		const separateClient = await request(server).get(STATUS_ROUTE).set('X-Forwarded-For', clientB);

		expect(separateClient.status).toBe(200);
	}, 30000);
});
