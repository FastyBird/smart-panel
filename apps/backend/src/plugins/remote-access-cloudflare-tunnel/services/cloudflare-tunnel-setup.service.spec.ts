import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { ManagedServiceManagerService } from '../../../modules/extensions/services/managed-service-manager.service';
import { PlatformType } from '../../../modules/platform/platform.constants';
import { PlatformService } from '../../../modules/platform/services/platform.service';
import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import {
	PrivilegedJobStatus,
	PrivilegedWorkerService,
} from '../../../modules/system/services/privileged-worker.service';
import { PrivilegedWorkerUnavailableException } from '../../../modules/system/system.exceptions';
import { CLOUDFLARE_TUNNEL_SETUP_WORKER_UNIT } from '../remote-access-cloudflare-tunnel.constants';

import { CloudflareTunnelManagedService } from './cloudflare-tunnel-managed.service';
import {
	CloudflareTunnelSetupService,
	CloudflareTunnelSetupUnavailableException,
} from './cloudflare-tunnel-setup.service';

type StatusHandler = (status: PrivilegedJobStatus) => void;

describe('CloudflareTunnelSetupService', () => {
	let service: CloudflareTunnelSetupService;
	let privilegedWorker: {
		run: jest.Mock<Promise<{ id: string }>, [Parameters<PrivilegedWorkerService['run']>[0]]>;
		onStatus: jest.Mock;
		getStatus: jest.Mock;
	};
	let nestConfigServiceMock: { get: jest.Mock };
	let tunnelManagedService: { refreshRequirements: jest.Mock };
	let eventEmitterMock: { emit: jest.Mock };
	let platformServiceMock: {
		getPrivilegedWorkerSupport: jest.Mock;
		isPlatformCapableOfPrivilegedWorkers: jest.Mock;
		getPlatformType: jest.Mock;
	};
	let configServiceMock: { getPluginConfig: jest.Mock };
	let managedServiceManagerMock: { restartService: jest.Mock };
	let dataDir: string;
	let unsubscribe: jest.Mock;
	let capturedHandler: StatusHandler | null;

	beforeEach(async () => {
		dataDir = mkdtempSync(join(tmpdir(), 'ra13-setup-'));
		unsubscribe = jest.fn();
		capturedHandler = null;

		privilegedWorker = {
			run: jest
				.fn<Promise<{ id: string }>, [Parameters<PrivilegedWorkerService['run']>[0]]>()
				.mockResolvedValue({ id: 'job-1' }),
			onStatus: jest.fn().mockImplementation((_id: string, handler: StatusHandler) => {
				capturedHandler = handler;

				return unsubscribe;
			}),
			getStatus: jest.fn().mockReturnValue(null),
		};

		nestConfigServiceMock = {
			get: jest.fn().mockImplementation((key: string) => (key === 'FB_DATA_DIR' ? dataDir : undefined)),
		};

		tunnelManagedService = { refreshRequirements: jest.fn().mockResolvedValue([]) };
		eventEmitterMock = { emit: jest.fn() };
		platformServiceMock = {
			getPrivilegedWorkerSupport: jest
				.fn()
				.mockResolvedValue({ supported: true, reason: null, checkedAt: '2026-09-08T00:00:00.000Z' }),
			isPlatformCapableOfPrivilegedWorkers: jest.fn().mockReturnValue(true),
			getPlatformType: jest.fn().mockReturnValue(PlatformType.DOCKER),
		};
		configServiceMock = {
			getPluginConfig: jest.fn().mockReturnValue({ enabled: true }),
		};
		managedServiceManagerMock = { restartService: jest.fn().mockResolvedValue(true) };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CloudflareTunnelSetupService,
				{ provide: PrivilegedWorkerService, useValue: privilegedWorker },
				{ provide: NestConfigService, useValue: nestConfigServiceMock },
				{ provide: CloudflareTunnelManagedService, useValue: tunnelManagedService },
				{ provide: EventEmitter2, useValue: eventEmitterMock },
				{ provide: PlatformService, useValue: platformServiceMock },
				{ provide: ConfigService, useValue: configServiceMock },
				{ provide: ManagedServiceManagerService, useValue: managedServiceManagerMock },
			],
		}).compile();

		service = module.get(CloudflareTunnelSetupService);
	});

	afterEach(() => {
		rmSync(dataDir, { recursive: true, force: true });
	});

	describe('install()', () => {
		it('spawns the privileged worker with the setup script and returns its id', async () => {
			const { id } = await service.install();

			expect(id).toBe('job-1');
			expect(privilegedWorker.run).toHaveBeenCalledTimes(1);

			const spec = privilegedWorker.run.mock.calls[0][0];

			expect(spec.unit).toBe(CLOUDFLARE_TUNNEL_SETUP_WORKER_UNIT);
			expect(spec.script).toContain('cloudflared-setup.sh');
			expect(existsSync(spec.script)).toBe(true);
		});

		it('creates the data subdirectory for the status file', async () => {
			await service.install();

			const spec = privilegedWorker.run.mock.calls[0][0];

			expect(existsSync(join(spec.statusFile, '..'))).toBe(true);
		});

		it('throws platform-unsupported when the platform cannot run privileged workers at all', async () => {
			platformServiceMock.getPrivilegedWorkerSupport.mockResolvedValue({
				supported: false,
				reason: "The 'docker' platform does not support privileged workers.",
				checkedAt: '2026-09-08T00:00:00.000Z',
			});
			platformServiceMock.isPlatformCapableOfPrivilegedWorkers.mockReturnValue(false);

			await expect(service.install()).rejects.toMatchObject({
				code: 'platform-unsupported',
			});
			expect(privilegedWorker.run).not.toHaveBeenCalled();
		});

		it('throws privileged-worker-unavailable when the platform is capable but the probe currently fails', async () => {
			platformServiceMock.getPrivilegedWorkerSupport.mockResolvedValue({
				supported: false,
				reason: 'sudo: a password is required',
				checkedAt: '2026-09-08T00:00:00.000Z',
			});
			platformServiceMock.isPlatformCapableOfPrivilegedWorkers.mockReturnValue(true);

			const error = await service.install().catch((caught: unknown) => caught);

			expect(error).toBeInstanceOf(CloudflareTunnelSetupUnavailableException);
			expect((error as CloudflareTunnelSetupUnavailableException).code).toBe('privileged-worker-unavailable');
			expect((error as Error).message).toContain('sudo: a password is required');
			expect(privilegedWorker.run).not.toHaveBeenCalled();
		});

		it('propagates a busy-unit refusal from the privileged worker unchanged', async () => {
			privilegedWorker.run.mockRejectedValue(
				new PrivilegedWorkerUnavailableException(
					`Privileged worker unit "${CLOUDFLARE_TUNNEL_SETUP_WORKER_UNIT}" is already busy.`,
				),
			);

			await expect(service.install()).rejects.toBeInstanceOf(PrivilegedWorkerUnavailableException);
		});
	});

	describe('progress and completion', () => {
		it('forwards every status tick as a RemoteAccessModule.Setup.Progress event', async () => {
			await service.install();

			capturedHandler?.({ id: 'job-1', state: 'running', step: 'install', updatedAt: '2026-09-08T00:00:00.000Z' });

			expect(eventEmitterMock.emit).toHaveBeenCalledWith(
				RemoteAccessEventType.SETUP_PROGRESS,
				expect.objectContaining({ job: 'job-1', state: 'running', step: 'install' }),
			);
		});

		it('updates getLastJob() on every tick', async () => {
			await service.install();

			capturedHandler?.({ id: 'job-1', state: 'running', step: 'install', updatedAt: '2026-09-08T00:00:00.000Z' });

			expect(service.getLastJob()).toMatchObject({ id: 'job-1', status: { state: 'running', step: 'install' } });
		});

		it('returns null from getLastJob() before any install has run', () => {
			expect(service.getLastJob()).toBeNull();
		});

		it('refreshes requirements and restarts the tunnel service when the plugin is enabled', async () => {
			await service.install();

			capturedHandler?.({ id: 'job-1', state: 'complete', step: 'complete', updatedAt: '2026-09-08T00:00:00.000Z' });
			await Promise.resolve();
			await Promise.resolve();

			expect(tunnelManagedService.refreshRequirements).toHaveBeenCalled();
			expect(managedServiceManagerMock.restartService).toHaveBeenCalledWith(
				'plugin',
				'remote-access-cloudflare-tunnel-plugin',
				'tunnel',
			);
		});

		it('does not restart the tunnel service when the plugin is disabled', async () => {
			configServiceMock.getPluginConfig.mockReturnValue({ enabled: false });

			await service.install();

			capturedHandler?.({ id: 'job-1', state: 'complete', step: 'complete', updatedAt: '2026-09-08T00:00:00.000Z' });
			await Promise.resolve();
			await Promise.resolve();

			expect(managedServiceManagerMock.restartService).not.toHaveBeenCalled();
		});

		it('never restarts the tunnel service when the job fails', async () => {
			await service.install();

			capturedHandler?.({ id: 'job-1', state: 'failed', step: 'install', updatedAt: '2026-09-08T00:00:00.000Z' });
			await Promise.resolve();
			await Promise.resolve();

			expect(managedServiceManagerMock.restartService).not.toHaveBeenCalled();
		});

		it('unsubscribes once a terminal state is reached', async () => {
			await service.install();

			capturedHandler?.({ id: 'job-1', state: 'complete', step: 'complete', updatedAt: '2026-09-08T00:00:00.000Z' });

			expect(unsubscribe).toHaveBeenCalled();
		});
	});
});
