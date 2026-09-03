/*
eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
*/
import { execFile } from 'node:child_process';
import request from 'supertest';

import { CanActivate, ExecutionContext, INestApplication, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { TokenOwnerType } from '../src/modules/auth/auth.constants';
import { AuthenticatedEntity, AuthenticatedRequest } from '../src/modules/auth/guards/auth.guard';
import { ConfigService } from '../src/modules/config/services/config.service';
import { PlatformType } from '../src/modules/platform/platform.constants';
import { PlatformService } from '../src/modules/platform/services/platform.service';
import { PrivilegedWorkerUnavailableException } from '../src/modules/system/system.exceptions';
import { RolesGuard } from '../src/modules/users/guards/roles.guard';
import { UserRole } from '../src/modules/users/users.constants';
import { SetupController } from '../src/plugins/remote-access-tailscale/controllers/setup.controller';
import { StatusController } from '../src/plugins/remote-access-tailscale/controllers/status.controller';
import { RemoteAccessTailscalePluginConfigModel } from '../src/plugins/remote-access-tailscale/models/config.model';
import { TailscaleCliService } from '../src/plugins/remote-access-tailscale/services/tailscale-cli.service';
import { TailscaleLoginService } from '../src/plugins/remote-access-tailscale/services/tailscale-login.service';
import { TailscaleNodeManagedService } from '../src/plugins/remote-access-tailscale/services/tailscale-node-managed.service';
import { TailscaleProviderService } from '../src/plugins/remote-access-tailscale/services/tailscale-provider.service';
import { TailscaleServeService } from '../src/plugins/remote-access-tailscale/services/tailscale-serve.service';
import {
	TailscaleSetupService,
	TailscaleSetupUnavailableException,
} from '../src/plugins/remote-access-tailscale/services/tailscale-setup.service';
import { TailscaleStatusMapperService } from '../src/plugins/remote-access-tailscale/services/tailscale-status-mapper.service';

// The CLI wrapper and the managed service's own prerequisite probes both go
// through `execFile` — this is the seam the brief calls out for the e2e
// test: mock the process boundary, exercise everything above it for real.
jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

type ExecFileCallback = (error: Error | null, stdout?: string, stderr?: string) => void;

const CONNECTED_STATUS_JSON = JSON.stringify({
	BackendState: 'Running',
	Self: { Online: true, TailscaleIPs: ['100.64.0.5'], DNSName: 'panel.tailc0ffee.ts.net.' },
	CurrentTailnet: { Name: 'example.ts.net', MagicDNSEnabled: true },
	Version: '1.78.1',
});

function mockProcesses(): void {
	(execFile as unknown as jest.Mock).mockImplementation(
		(file: string, args: string[], _options: unknown, ...rest: unknown[]) => {
			const callback = rest[rest.length - 1] as ExecFileCallback;

			if (file === 'tailscale' && args[0] === 'version') {
				callback(null, JSON.stringify({ majorMinorPatch: '1.78.1', short: '1.78.1' }), '');
			} else if (file === 'tailscale' && args[0] === 'status') {
				callback(null, CONNECTED_STATUS_JSON, '');
			} else if (file === 'tailscale' && args[0] === 'serve' && args[1] === 'status') {
				// The fixture's plugin config disables serve_https (see
				// `configService` below), so nothing ever actually gets served —
				// this is read (and, since it reports nothing to remove, never
				// mutated) on every connected status computation regardless.
				// `tailscale funnel status --json` is registered as the exact
				// same command upstream, so there is no separate branch for it.
				callback(null, '{}', '');
			} else if (file === 'systemctl') {
				callback(null, 'active\n', '');
			} else {
				callback(new Error(`unexpected exec: ${file} ${args.join(' ')}`), '', '');
			}

			return {};
		},
	);
}

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

/**
 * Exercises `GET /status` end to end with the real CLI service, mapper,
 * managed service and controller wired together — only `execFile` (the
 * process boundary) and the config/platform lookups are mocked. Mirrors the
 * lightweight controller-slice pattern used by
 * `remote-access-module.e2e-spec.ts`: real controller and real plugin
 * services through a minimal testing module rather than the full AppModule.
 */
describe('Remote access Tailscale plugin status endpoint (e2e)', () => {
	let app: INestApplication;
	// `TailscaleSetupService`/`TailscaleLoginService` are mocked here rather
	// than wired for real: their own detailed behaviour (spawn args, auth-key
	// file lifecycle, two-block JSON parsing) is covered by their unit specs.
	// This e2e's job for the four mutating endpoints is role gating and
	// response shape/headers through the real HTTP + guard stack, exactly
	// like the existing GET /status suite below covers that endpoint.
	let setupServiceMock: { install: jest.Mock };
	let loginServiceMock: {
		login: jest.Mock;
		logout: jest.Mock;
		resetPreferences: jest.Mock;
		getPendingInteractiveAuth: jest.Mock;
	};

	beforeAll(async () => {
		mockProcesses();

		// `serveHttps`/`funnel` are left at `false` — CONNECTED_STATUS_JSON
		// carries no `Self.CapMap`, so wanting Serve/Funnel against a tailnet
		// with no reported capability would raise the `tailnet-https-disabled`
		// advisory and break the plain "connected" fixture every test below
		// shares. `TailscaleNodeManagedService` caches the plugin config on
		// its first read for the lifetime of this single `app` instance, so
		// this mock cannot be swapped per-test the way `setupServiceMock`/
		// `loginServiceMock` are — the Serve/Funnel apply matrix itself is
		// covered in full, independent of that caching, by
		// tailscale-serve.service.spec.ts and tailscale-node-managed.service.spec.ts.
		const configService = {
			getPluginConfig: jest.fn().mockImplementation(() => {
				const config = new RemoteAccessTailscalePluginConfigModel();
				config.serveHttps = false;
				config.funnel = false;

				return config;
			}),
		};
		const nestConfigService = { get: jest.fn((key: string) => ({ FB_BACKEND_PORT: 3000 })[key]) };
		const platformService = { getPlatformType: jest.fn().mockReturnValue(PlatformType.RASPBERRY) };

		setupServiceMock = { install: jest.fn() };
		loginServiceMock = {
			login: jest.fn(),
			logout: jest.fn(),
			resetPreferences: jest.fn(),
			getPendingInteractiveAuth: jest.fn().mockReturnValue(null),
		};

		const moduleFixture = await Test.createTestingModule({
			controllers: [StatusController, SetupController],
			providers: [
				{ provide: APP_GUARD, useClass: TestCredentialGuard },
				{ provide: APP_GUARD, useClass: RolesGuard },
				{ provide: ConfigService, useValue: configService },
				{ provide: NestConfigService, useValue: nestConfigService },
				{ provide: PlatformService, useValue: platformService },
				{ provide: EventEmitter2, useValue: { emit: jest.fn(), onAny: jest.fn() } },
				TailscaleCliService,
				TailscaleStatusMapperService,
				TailscaleServeService,
				TailscaleNodeManagedService,
				TailscaleProviderService,
				{ provide: TailscaleSetupService, useValue: setupServiceMock },
				{ provide: TailscaleLoginService, useValue: loginServiceMock },
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	afterEach(() => {
		setupServiceMock.install.mockReset();
		loginServiceMock.login.mockReset();
		loginServiceMock.logout.mockReset();
		loginServiceMock.resetPreferences.mockReset();
		loginServiceMock.getPendingInteractiveAuth.mockReset().mockReturnValue(null);
	});

	describe('GET /status', () => {
		it.each(['owner-user', 'admin-user'])('returns the full node status for %s', async (credential) => {
			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', `Bearer ${credential}`)
				.expect(200);

			// This minimal testing module does not register the app-wide
			// `TransformResponseInterceptor` (see remote-access-module.e2e-spec.ts
			// for the same convention), so the response reflects the plain
			// controller return value — camelCase field names, not the
			// `@Expose({ name: 'snake_case' })` wire format the real app applies.
			expect(response.body.data).toMatchObject({
				type: 'remote-access-tailscale-plugin',
				state: 'connected',
				proxyAddresses: [],
				advisories: [],
			});
			expect(response.body.data.endpoints).toEqual(
				expect.arrayContaining([
					{ url: 'http://100.64.0.5:3000', scope: 'private', https: false, label: 'Tailscale IPv4' },
				]),
			);
			expect(response.body.data.requirements).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: 'platform-supported', satisfied: true }),
					expect.objectContaining({ code: 'binary-installed', satisfied: true }),
					expect.objectContaining({ code: 'daemon-active', satisfied: true }),
					expect.objectContaining({ code: 'operator-granted', satisfied: true }),
					expect.objectContaining({ code: 'version-supported', satisfied: true }),
				]),
			);
			expect(response.body.data.requirements).toHaveLength(5);
			expect(response.body.data).not.toHaveProperty('authUrl');
			expect(response.body.data).not.toHaveProperty('auth_url');
			expect(response.body.data).not.toHaveProperty('qr');
		});

		it.each(['regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer()).get('/status').set('Authorization', `Bearer ${credential}`).expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).get('/status').expect(401);
		});

		it('does not set Cache-Control when connected', async () => {
			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.headers['cache-control']).toBeUndefined();
		});

		it('sets Cache-Control: no-store while pending-auth', async () => {
			// A full custom implementation (not mockImplementationOnce) — a
			// single request fans out to several execFile calls (status is
			// read twice: once for the live status, once for the
			// operator-granted probe), so every `tailscale status` call must
			// consistently report NeedsLogin for this scenario.
			(execFile as unknown as jest.Mock).mockImplementation(
				(file: string, args: string[], _options: unknown, ...rest: unknown[]) => {
					const callback = rest[rest.length - 1] as ExecFileCallback;

					if (file === 'tailscale' && args[0] === 'version') {
						callback(null, JSON.stringify({ majorMinorPatch: '1.78.1' }), '');
					} else if (file === 'tailscale' && args[0] === 'status') {
						callback(
							null,
							JSON.stringify({ BackendState: 'NeedsLogin', AuthURL: 'https://login.tailscale.com/a/xyz' }),
							'',
						);
					} else if (file === 'systemctl') {
						callback(null, 'active\n', '');
					} else {
						callback(new Error(`unexpected exec: ${file} ${args.join(' ')}`), '', '');
					}

					return {};
				},
			);

			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.body.data.state).toBe('pending-auth');
			expect(response.headers['cache-control']).toBe('no-store');
			expect(JSON.stringify(response.body)).not.toContain('login.tailscale.com');

			mockProcesses();
		});
	});

	describe('POST /install', () => {
		it('owner: starts the setup job and returns 202 with the job id', async () => {
			setupServiceMock.install.mockResolvedValue({ id: 'job-1' });

			const response = await request(app.getHttpServer())
				.post('/install')
				.set('Authorization', 'Bearer owner-user')
				.expect(202);

			expect(response.body.data.job).toBe('job-1');
		});

		it.each(['admin-user', 'regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer()).post('/install').set('Authorization', `Bearer ${credential}`).expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).post('/install').expect(401);
		});

		it('maps a busy-unit refusal (transient) to 409', async () => {
			setupServiceMock.install.mockRejectedValue(
				new PrivilegedWorkerUnavailableException('Privileged worker unit "smart-panel-remote-access" is already busy.'),
			);

			await request(app.getHttpServer()).post('/install').set('Authorization', 'Bearer owner-user').expect(409);
		});

		it('maps an unsupported-platform or dev-override refusal (permanent) to 422', async () => {
			setupServiceMock.install.mockRejectedValue(
				new TailscaleSetupUnavailableException(
					"Tailscale setup requires a platform with privileged-worker support; the 'docker' platform does not have it.",
				),
			);

			await request(app.getHttpServer()).post('/install').set('Authorization', 'Bearer owner-user').expect(422);
		});
	});

	describe('POST /login', () => {
		it.each(['owner-user', 'admin-user'])('allows %s and returns the sign-in result', async (credential) => {
			loginServiceMock.login.mockResolvedValue({
				state: 'pending-auth',
				authUrl: 'https://login.tailscale.com/a/xyz',
				qr: 'data:image/png;base64,AAA',
			});

			const response = await request(app.getHttpServer())
				.post('/login')
				.set('Authorization', `Bearer ${credential}`)
				.send({})
				.expect(200);

			expect(response.body.data).toMatchObject({
				state: 'pending-auth',
				authUrl: 'https://login.tailscale.com/a/xyz',
				qr: 'data:image/png;base64,AAA',
			});
		});

		it.each(['regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer())
				.post('/login')
				.set('Authorization', `Bearer ${credential}`)
				.send({})
				.expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).post('/login').send({}).expect(401);
		});

		it('sets Cache-Control: no-store on every response, since it may carry a capability URL', async () => {
			loginServiceMock.login.mockResolvedValue({ state: 'connected' });

			const response = await request(app.getHttpServer())
				.post('/login')
				.set('Authorization', 'Bearer owner-user')
				.send({})
				.expect(200);

			expect(response.headers['cache-control']).toBe('no-store');
		});

		it('accepts an optional auth key body and forwards it to the login service', async () => {
			loginServiceMock.login.mockResolvedValue({ state: 'connected' });

			// This minimal testing module does not register the app-wide
			// ValidationPipe (see the GET /status doc comment above for the
			// same convention on the response side), so the body reaches the
			// controller untransformed — camelCase, not the `auth_key` wire
			// name a real request would use.
			await request(app.getHttpServer())
				.post('/login')
				.set('Authorization', 'Bearer owner-user')
				.send({ authKey: 'tskey-auth-e2e-secret' })
				.expect(200);

			expect(loginServiceMock.login).toHaveBeenCalledWith('tskey-auth-e2e-secret');
		});

		it('never echoes a submitted auth key back in the response body', async () => {
			loginServiceMock.login.mockResolvedValue({ state: 'connected' });

			const response = await request(app.getHttpServer())
				.post('/login')
				.set('Authorization', 'Bearer owner-user')
				.send({ authKey: 'tskey-auth-e2e-secret' })
				.expect(200);

			expect(JSON.stringify(response.body)).not.toContain('tskey-auth-e2e-secret');
		});
	});

	describe('POST /logout', () => {
		it('owner: signs out and returns the resulting node status', async () => {
			loginServiceMock.logout.mockResolvedValue({ state: 'setup-required' });

			const response = await request(app.getHttpServer())
				.post('/logout')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.body.data.type).toBe('remote-access-tailscale-plugin');
		});

		it.each(['admin-user', 'regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer()).post('/logout').set('Authorization', `Bearer ${credential}`).expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).post('/logout').expect(401);
		});
	});

	describe('POST /reset-preferences', () => {
		it('owner: resets preferences and returns the resulting node status', async () => {
			loginServiceMock.resetPreferences.mockResolvedValue({ state: 'connected' });

			const response = await request(app.getHttpServer())
				.post('/reset-preferences')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.body.data.type).toBe('remote-access-tailscale-plugin');
		});

		it.each(['admin-user', 'regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer())
				.post('/reset-preferences')
				.set('Authorization', `Bearer ${credential}`)
				.expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).post('/reset-preferences').expect(401);
		});
	});
});
