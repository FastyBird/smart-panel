/*
eslint-disable @typescript-eslint/no-unsafe-member-access
*/
import { execFile } from 'node:child_process';
import request from 'supertest';

import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';

import { createGlobalExceptionFilters } from '../src/common/filters/global-filters';
import { TokenOwnerType } from '../src/modules/auth/auth.constants';
import { AuthenticatedEntity, AuthenticatedRequest } from '../src/modules/auth/guards/auth.guard';
import { ConfigService } from '../src/modules/config/services/config.service';
import { PlatformType } from '../src/modules/platform/platform.constants';
import { PlatformService } from '../src/modules/platform/services/platform.service';
import { PrivilegedWorkerUnavailableException } from '../src/modules/system/system.exceptions';
import { RolesGuard } from '../src/modules/users/guards/roles.guard';
import { UserRole } from '../src/modules/users/users.constants';
import { SetupController } from '../src/plugins/remote-access-cloudflare-tunnel/controllers/setup.controller';
import { StatusController } from '../src/plugins/remote-access-cloudflare-tunnel/controllers/status.controller';
import { RemoteAccessCloudflareTunnelPluginConfigModel } from '../src/plugins/remote-access-cloudflare-tunnel/models/config.model';
import { CloudflareTunnelManagedService } from '../src/plugins/remote-access-cloudflare-tunnel/services/cloudflare-tunnel-managed.service';
import { CloudflareTunnelProviderService } from '../src/plugins/remote-access-cloudflare-tunnel/services/cloudflare-tunnel-provider.service';
import {
	CloudflareTunnelSetupService,
	CloudflareTunnelSetupUnavailableException,
} from '../src/plugins/remote-access-cloudflare-tunnel/services/cloudflare-tunnel-setup.service';
import { CloudflaredCliService } from '../src/plugins/remote-access-cloudflare-tunnel/services/cloudflared-cli.service';
import { CloudflaredMetricsService } from '../src/plugins/remote-access-cloudflare-tunnel/services/cloudflared-metrics.service';
import { CloudflaredProcessService } from '../src/plugins/remote-access-cloudflare-tunnel/services/cloudflared-process.service';

// The version/print-plan probe is the only thing this plugin shells out to via `execFile` —
// the tunnel connector itself is a supervised child process (`CloudflaredProcessService`,
// mocked below wholesale, same as `CloudflaredMetricsService`) rather than a CLI-driven daemon,
// so there is nothing equivalent to Tailscale's live `status --json` polling to exercise here.
jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	execFile: jest.fn(),
}));

type ExecFileCallback = (error: Error | null, stdout?: string, stderr?: string) => void;

function mockExecFile(): void {
	(execFile as unknown as jest.Mock).mockImplementation(
		(file: string, args: string[], _options: unknown, ...rest: unknown[]) => {
			const callback = rest[rest.length - 1] as ExecFileCallback;

			if (file === 'cloudflared' && args[0] === '--version') {
				callback(null, 'cloudflared version 2024.6.1 (built 2024-06-18-1341 UTC)\n', '');
			} else if (file === 'bash') {
				callback(null, 'apt-get install -y -qq --no-install-recommends cloudflared\n', '');
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
 * Exercises `GET /status`, `POST /install` and `POST /reset` end to end with the real
 * controllers and the real `CloudflareTunnelManagedService`/`CloudflareTunnelProviderService`
 * composition — only the process/metrics/CLI boundary services and `ConfigService` are mocked,
 * plus `CloudflareTunnelSetupService` (its own detailed behaviour is covered by its unit spec).
 * Mirrors the lightweight controller-slice pattern `remote-access-tailscale-plugin.e2e-spec.ts`
 * uses, and registers the production exception filter chain (D13) so the 409/422 assertions
 * below observe the real `BaseErrorResponseModel` envelope.
 */
describe('Remote access Cloudflare Tunnel plugin endpoints (e2e)', () => {
	let app: NestFastifyApplication;
	let tunnelManagedService: CloudflareTunnelManagedService;
	let setupServiceMock: { install: jest.Mock; getLastJob: jest.Mock };
	let processServiceMock: {
		isRunning: jest.Mock;
		getStartedAt: jest.Mock;
		getLastExit: jest.Mock;
		getLastStderrLine: jest.Mock;
		start: jest.Mock;
		stop: jest.Mock;
	};
	let metricsServiceMock: { fetchReady: jest.Mock };
	let configServiceMock: { getPluginConfig: jest.Mock; updatePluginConfig: jest.Mock };
	let platformServiceMock: {
		getPlatformType: jest.Mock;
		getPlatformTypeAsync: jest.Mock;
		getPrivilegedWorkerSupport: jest.Mock;
		isPlatformCapableOfPrivilegedWorkers: jest.Mock;
	};

	function buildConfig(overrides: Partial<RemoteAccessCloudflareTunnelPluginConfigModel> = {}) {
		const config = new RemoteAccessCloudflareTunnelPluginConfigModel();
		config.publicHostname = 'panel.example.com';
		config.protocol = 'auto';
		config.tunnelToken = 'a-real-token';

		return Object.assign(config, overrides);
	}

	beforeAll(async () => {
		mockExecFile();

		processServiceMock = {
			isRunning: jest.fn().mockReturnValue(true),
			getStartedAt: jest.fn().mockReturnValue(Date.now()),
			getLastExit: jest.fn().mockReturnValue(null),
			getLastStderrLine: jest.fn().mockReturnValue(null),
			start: jest.fn(),
			stop: jest.fn().mockResolvedValue(undefined),
		};
		metricsServiceMock = { fetchReady: jest.fn().mockResolvedValue({ readyConnections: 3, connectorId: 'conn-1' }) };
		configServiceMock = {
			getPluginConfig: jest.fn().mockImplementation(() => buildConfig()),
			updatePluginConfig: jest.fn().mockResolvedValue(undefined),
		};
		platformServiceMock = {
			getPlatformType: jest.fn().mockReturnValue(PlatformType.RASPBERRY),
			getPlatformTypeAsync: jest.fn().mockResolvedValue(PlatformType.RASPBERRY),
			getPrivilegedWorkerSupport: jest
				.fn()
				.mockResolvedValue({ supported: true, reason: null, checkedAt: '2026-09-08T00:00:00.000Z' }),
			isPlatformCapableOfPrivilegedWorkers: jest.fn().mockReturnValue(true),
		};
		setupServiceMock = { install: jest.fn(), getLastJob: jest.fn().mockReturnValue(null) };

		const moduleFixture = await Test.createTestingModule({
			controllers: [StatusController, SetupController],
			providers: [
				{ provide: APP_GUARD, useClass: TestCredentialGuard },
				{ provide: APP_GUARD, useClass: RolesGuard },
				{ provide: ConfigService, useValue: configServiceMock },
				{ provide: NestConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
				{ provide: PlatformService, useValue: platformServiceMock },
				{ provide: EventEmitter2, useValue: { emit: jest.fn(), onAny: jest.fn() } },
				{ provide: CloudflaredProcessService, useValue: processServiceMock },
				{ provide: CloudflaredMetricsService, useValue: metricsServiceMock },
				CloudflaredCliService,
				CloudflareTunnelManagedService,
				CloudflareTunnelProviderService,
				{ provide: CloudflareTunnelSetupService, useValue: setupServiceMock },
			],
		}).compile();

		app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
		app.useGlobalFilters(...createGlobalExceptionFilters(moduleFixture.get(NestConfigService)));
		await app.listen(0, '127.0.0.1');

		tunnelManagedService = app.get(CloudflareTunnelManagedService);
		await tunnelManagedService.start();
	});

	afterAll(async () => {
		await tunnelManagedService.stop().catch(() => undefined);
		await app.close();
	});

	afterEach(() => {
		setupServiceMock.install.mockReset();
		setupServiceMock.getLastJob.mockReset().mockReturnValue(null);
		platformServiceMock.getPrivilegedWorkerSupport
			.mockReset()
			.mockResolvedValue({ supported: true, reason: null, checkedAt: '2026-09-08T00:00:00.000Z' });
		configServiceMock.updatePluginConfig.mockReset().mockResolvedValue(undefined);
	});

	describe('GET /status', () => {
		it.each(['owner-user', 'admin-user'])('returns the full tunnel status for %s', async (credential) => {
			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', `Bearer ${credential}`)
				.expect(200);

			expect(response.body.data).toMatchObject({
				type: 'remote-access-cloudflare-tunnel-plugin',
				state: 'connected',
				proxyAddresses: ['127.0.0.1', '::1'],
			});
			expect(response.body.data.endpoints).toEqual([
				{ url: 'https://panel.example.com', scope: 'public', https: true, label: 'Cloudflare Tunnel' },
			]);
			expect(response.body.data.requirements).toHaveLength(4);
			expect(response.body.data.requirements).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ code: 'platform-supported', satisfied: true }),
					expect.objectContaining({ code: 'binary-installed', satisfied: true }),
					expect.objectContaining({ code: 'version-supported', satisfied: true }),
					expect.objectContaining({ code: 'token-configured', satisfied: true }),
				]),
			);
			expect(response.body.data.setup).toBeNull();
			expect(response.body.data.privilegedSetup).toEqual({ available: true, reason: null });
		});

		it('reports the last known setup job on GET /status', async () => {
			setupServiceMock.getLastJob.mockReturnValue({
				id: 'job-1',
				status: {
					id: 'job-1',
					state: 'running',
					step: 'install',
					message: 'Installing cloudflared',
					updatedAt: '2026-09-08T00:00:00.000Z',
				},
			});

			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.body.data.setup).toMatchObject({
				jobId: 'job-1',
				state: 'running',
				step: 'install',
				message: 'Installing cloudflared',
			});
		});

		it('reports privilegedSetup unavailable with a reason when the probe fails', async () => {
			platformServiceMock.getPrivilegedWorkerSupport.mockResolvedValue({
				supported: false,
				reason: 'sudo: a password is required',
				checkedAt: '2026-09-08T00:00:00.000Z',
			});

			const response = await request(app.getHttpServer())
				.get('/status')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(response.body.data.privilegedSetup).toEqual({
				available: false,
				reason: 'sudo: a password is required',
			});
		});

		it.each(['regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer()).get('/status').set('Authorization', `Bearer ${credential}`).expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).get('/status').expect(401);
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
				new PrivilegedWorkerUnavailableException(
					'Privileged worker unit "smart-panel-remote-access-cloudflare" is already busy.',
				),
			);

			await request(app.getHttpServer()).post('/install').set('Authorization', 'Bearer owner-user').expect(409);
		});

		it('maps an unsupported-platform refusal (permanent) to 422 with code: platform-unsupported', async () => {
			setupServiceMock.install.mockRejectedValue(
				new CloudflareTunnelSetupUnavailableException(
					"Cloudflare Tunnel setup requires a platform with privileged-worker support; the 'docker' platform does not have it.",
					'platform-unsupported',
				),
			);

			const response = await request(app.getHttpServer())
				.post('/install')
				.set('Authorization', 'Bearer owner-user')
				.expect(422);

			// D13: the production envelope carries the application code in `error.details.code`
			// and the message in `error.details.reason`.
			expect(response.body.error.details.code).toBe('platform-unsupported');
			expect(response.body.error.details.reason).toContain('privileged-worker support');
		});

		it('maps a probe-currently-failing refusal (permanent, but self-resolving) to 422 with code: privileged-worker-unavailable', async () => {
			setupServiceMock.install.mockRejectedValue(
				new CloudflareTunnelSetupUnavailableException(
					'sudo: a password is required. Re-run `sudo smart-panel-service install`, or add the sudoers grant from the installation guide.',
					'privileged-worker-unavailable',
				),
			);

			const response = await request(app.getHttpServer())
				.post('/install')
				.set('Authorization', 'Bearer owner-user')
				.expect(422);

			expect(response.body.error.details.code).toBe('privileged-worker-unavailable');
			expect(response.body.error.details.reason).toContain('sudo smart-panel-service install');
		});
	});

	describe('POST /reset', () => {
		it('owner: stops the tunnel, clears the token/hostname and returns the resulting status', async () => {
			const response = await request(app.getHttpServer())
				.post('/reset')
				.set('Authorization', 'Bearer owner-user')
				.expect(200);

			expect(processServiceMock.stop).toHaveBeenCalled();
			expect(configServiceMock.updatePluginConfig).toHaveBeenCalledWith(
				'remote-access-cloudflare-tunnel-plugin',
				expect.objectContaining({ tunnelToken: null, publicHostname: null }),
				expect.objectContaining({ tunnel_token: null, public_hostname: null }),
			);
			expect(response.body.data.type).toBe('remote-access-cloudflare-tunnel-plugin');

			// Restore the started state for every test that runs after this one.
			await tunnelManagedService.start();
		});

		it.each(['admin-user', 'regular-user', 'display-token'])('denies %s', async (credential) => {
			await request(app.getHttpServer()).post('/reset').set('Authorization', `Bearer ${credential}`).expect(403);
		});

		it('denies an unauthenticated request', async () => {
			await request(app.getHttpServer()).post('/reset').expect(401);
		});
	});
});
