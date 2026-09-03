import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { ConfigService as NestConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';

import { EventType as RemoteAccessEventType } from '../../../modules/remote-access/remote-access.constants';
import {
	PrivilegedJobStatus,
	PrivilegedWorkerService,
} from '../../../modules/system/services/privileged-worker.service';
import { PrivilegedWorkerUnavailableException } from '../../../modules/system/system.exceptions';
import {
	REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV,
	TAILSCALE_SETUP_WORKER_UNIT,
} from '../remote-access-tailscale.constants';

import { TailscaleNodeManagedService } from './tailscale-node-managed.service';
import { TailscaleSetupService, TailscaleSetupUnavailableException } from './tailscale-setup.service';

type StatusHandler = (status: PrivilegedJobStatus) => void;

describe('TailscaleSetupService', () => {
	let service: TailscaleSetupService;
	// run is given an explicit generic (return, args) instead of a bare
	// jest.Mock so `privilegedWorker.run.mock.calls[0][0]` below resolves to
	// the real PrivilegedJobSpec type instead of `any`.
	let privilegedWorker: {
		run: jest.Mock<Promise<{ id: string }>, [Parameters<PrivilegedWorkerService['run']>[0]]>;
		onStatus: jest.Mock;
	};
	let nestConfigServiceMock: { get: jest.Mock };
	let nodeManagedService: { evaluateRequirements: jest.Mock };
	let eventEmitterMock: { emit: jest.Mock };
	let dataDir: string;
	let unsubscribe: jest.Mock;
	let capturedHandler: StatusHandler | null;

	beforeEach(async () => {
		dataDir = mkdtempSync(join(tmpdir(), 'ra5-setup-'));
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
		};

		nestConfigServiceMock = {
			get: jest.fn().mockImplementation((key: string) => {
				if (key === 'FB_DATA_DIR') {
					return dataDir;
				}

				return undefined;
			}),
		};

		nodeManagedService = { evaluateRequirements: jest.fn().mockResolvedValue([]) };
		eventEmitterMock = { emit: jest.fn() };

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TailscaleSetupService,
				{ provide: PrivilegedWorkerService, useValue: privilegedWorker },
				{ provide: NestConfigService, useValue: nestConfigServiceMock },
				{ provide: TailscaleNodeManagedService, useValue: nodeManagedService },
				{ provide: EventEmitter2, useValue: eventEmitterMock },
			],
		}).compile();

		service = module.get<TailscaleSetupService>(TailscaleSetupService);
	});

	afterEach(() => {
		rmSync(dataDir, { recursive: true, force: true });
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('install', () => {
		it('spawns the privileged job with the expected unit, script, env and status file', async () => {
			const result = await service.install();

			expect(result).toEqual({ id: 'job-1' });
			expect(privilegedWorker.run).toHaveBeenCalledTimes(1);

			const spec = privilegedWorker.run.mock.calls[0][0];
			const env = spec.env ?? {};

			expect(spec.unit).toBe(TAILSCALE_SETUP_WORKER_UNIT);
			expect(spec.script.endsWith(join('scripts', 'tailscale-setup.sh'))).toBe(true);
			expect(spec.args).toEqual([]);
			expect(spec.statusFile).toBe(join(dataDir, 'remote-access', 'tailscale-setup-status.json'));
			expect(env.STATUS_FILE).toBe(spec.statusFile);
			expect(typeof env.SMART_PANEL_USER).toBe('string');
			expect(env.SMART_PANEL_USER.length).toBeGreaterThan(0);
		});

		it('creates the remote-access data directory before spawning', async () => {
			expect(existsSync(join(dataDir, 'remote-access'))).toBe(false);

			await service.install();

			expect(existsSync(join(dataDir, 'remote-access'))).toBe(true);
		});

		it('refuses without spawning when FB_REMOTE_ACCESS_ALLOW_DEV is set', async () => {
			nestConfigServiceMock.get.mockImplementation((key: string) => {
				if (key === 'FB_DATA_DIR') return dataDir;
				if (key === REMOTE_ACCESS_TAILSCALE_ALLOW_DEV_ENV) return true;

				return undefined;
			});

			await expect(service.install()).rejects.toBeInstanceOf(TailscaleSetupUnavailableException);
			expect(privilegedWorker.run).not.toHaveBeenCalled();
		});

		it('propagates PrivilegedWorkerUnavailableException for an unsupported platform without a local retry', async () => {
			privilegedWorker.run.mockRejectedValue(
				new PrivilegedWorkerUnavailableException('Privileged workers are not supported on this platform (docker).'),
			);

			await expect(service.install()).rejects.toBeInstanceOf(PrivilegedWorkerUnavailableException);
			expect(privilegedWorker.run).toHaveBeenCalledTimes(1);
		});

		it('propagates PrivilegedWorkerUnavailableException when the unit is already busy', async () => {
			privilegedWorker.run.mockRejectedValue(
				new PrivilegedWorkerUnavailableException(
					`Privileged worker unit "${TAILSCALE_SETUP_WORKER_UNIT}" is already busy.`,
				),
			);

			await expect(service.install()).rejects.toBeInstanceOf(PrivilegedWorkerUnavailableException);
		});
	});

	describe('progress forwarding', () => {
		it('forwards every status tick as RemoteAccessModule.Setup.Progress with the job id', async () => {
			await service.install();

			expect(capturedHandler).not.toBeNull();

			capturedHandler({
				id: 'job-1',
				state: 'running',
				step: 'install',
				message: 'Installing',
				updatedAt: '2026-09-02T00:00:00.000Z',
			});

			expect(eventEmitterMock.emit).toHaveBeenCalledWith(RemoteAccessEventType.SETUP_PROGRESS, {
				type: 'remote-access-tailscale-plugin',
				job: 'job-1',
				step: 'install',
				state: 'running',
				message: 'Installing',
			});
			expect(unsubscribe).not.toHaveBeenCalled();
		});

		it('refreshes node requirements and unsubscribes once the job completes', async () => {
			await service.install();

			capturedHandler({
				id: 'job-1',
				state: 'complete',
				step: 'complete',
				message: 'done',
				updatedAt: '2026-09-02T00:00:00.000Z',
			});

			await Promise.resolve();
			await Promise.resolve();

			expect(nodeManagedService.evaluateRequirements).toHaveBeenCalledTimes(1);
			expect(unsubscribe).toHaveBeenCalledTimes(1);
		});

		it('surfaces the failing step and message on failure, without refreshing requirements', async () => {
			await service.install();

			capturedHandler({
				id: 'job-1',
				state: 'failed',
				step: 'daemon',
				message: 'systemctl enable --now tailscaled failed',
				updatedAt: '2026-09-02T00:00:00.000Z',
			});

			expect(eventEmitterMock.emit).toHaveBeenLastCalledWith(RemoteAccessEventType.SETUP_PROGRESS, {
				type: 'remote-access-tailscale-plugin',
				job: 'job-1',
				step: 'daemon',
				state: 'failed',
				message: 'systemctl enable --now tailscaled failed',
			});
			expect(nodeManagedService.evaluateRequirements).not.toHaveBeenCalled();
			expect(unsubscribe).toHaveBeenCalledTimes(1);
		});

		it('unsubscribes on a hard timeout tick too', async () => {
			await service.install();

			capturedHandler({ id: 'job-1', state: 'timeout', updatedAt: '2026-09-02T00:00:00.000Z' });

			expect(unsubscribe).toHaveBeenCalledTimes(1);
		});
	});
});
