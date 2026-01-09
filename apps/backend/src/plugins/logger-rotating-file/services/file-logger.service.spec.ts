/*
eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method,
@typescript-eslint/no-unnecessary-type-assertion
*/
/*
Reason: The mocking and test setup requires dynamic assignment and
handling of Jest mocks, which ESLint rules flag unnecessarily.
*/
import { CronJob } from 'cron';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from '../../../modules/config/services/config.service';
import { LOGGER_ROTATING_FILE_PLUGIN_NAME } from '../logger-rotating-file.constants';

import { FileLoggerService } from './file-logger.service';

jest.mock('node:fs', () => {
	return {
		promises: {
			mkdir: jest.fn(),
			stat: jest.fn(),
			writeFile: jest.fn(),
			rm: jest.fn(),
			appendFile: jest.fn(),
			readdir: jest.fn(),
		},
	};
});

jest.mock('cron', () => {
	const start = jest.fn();
	const stop = jest.fn();
	const CronJob = jest.fn().mockImplementation((_expr, onTick) => ({
		start,
		stop,
		fireOnTick: onTick,
	}));
	return { CronJob, __mocks: { start, stop } };
});

type Cfg = {
	enabled: boolean;
	dir?: string;
	retentionDays?: number;
	cleanupCron?: string;
	filePrefix?: string;
};

describe('FileLoggerService', () => {
	let svc: FileLoggerService;
	let cfgRef: Cfg;
	let configService: { getPluginConfig: jest.Mock };
	let scheduler: SchedulerRegistry;

	const cronName = `${LOGGER_ROTATING_FILE_PLUGIN_NAME}:cleanup`;
	const fsMock = fs as jest.Mocked<typeof fs>;
	const CronJobMock = CronJob as unknown as jest.Mock;

	beforeEach(async () => {
		cfgRef = {
			enabled: true,
			dir: path.resolve(process.cwd(), 'tmp-logs-test'),
			retentionDays: 7,
			cleanupCron: '15 3 * * *',
			filePrefix: 'smart-panel',
		};

		configService = {
			getPluginConfig: jest.fn().mockImplementation(() => cfgRef),
		};

		const schedulerStub = {
			addCronJob: jest.fn(),
			deleteCronJob: jest.fn(),
			doesExist: jest.fn().mockReturnValue(false),
			getCronJob: jest.fn(),
		};

		(fsMock.mkdir as jest.Mock).mockResolvedValue(undefined);
		(fsMock.stat as jest.Mock).mockResolvedValue({ isDirectory: () => true } as any);
		(fsMock.writeFile as jest.Mock).mockResolvedValue(undefined);
		(fsMock.rm as jest.Mock).mockResolvedValue(undefined);
		(fsMock.appendFile as jest.Mock).mockResolvedValue(undefined);
		(fsMock.readdir as jest.Mock).mockResolvedValue([]);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				FileLoggerService,
				{ provide: ConfigService, useValue: configService },
				{ provide: SchedulerRegistry, useValue: schedulerStub },
			],
		}).compile();

		svc = module.get(FileLoggerService);
		scheduler = module.get(SchedulerRegistry);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('start', () => {
		it('starts when enabled: validates dir and registers cron', async () => {
			await svc.start();

			expect(fsMock.mkdir).toHaveBeenCalled();
			expect(fsMock.stat).toHaveBeenCalled();
			expect(scheduler.addCronJob).toHaveBeenCalledTimes(1);

			const [name, job] = (scheduler.addCronJob as jest.Mock).mock.calls[0];

			expect(name).toBe(cronName);
			expect(job).toBeDefined();
			expect(CronJobMock).toHaveBeenCalledWith(cfgRef.cleanupCron, expect.any(Function));
		});

		it('stops when stop() is called: unregisters cron and clears dir', async () => {
			// First start the service
			await svc.start();
			(scheduler.doesExist as jest.Mock).mockReturnValue(true);

			// Then stop it
			await svc.stop();

			expect(scheduler.deleteCronJob).toHaveBeenCalledWith(cronName);

			// Clear mock calls from start() to test only append behavior
			(fsMock.appendFile as jest.Mock).mockClear();

			await svc.append({ a: 1 });

			expect(fsMock.appendFile).not.toHaveBeenCalled();
		});

		it('handles invalid dir: logs error and still registers nothing', async () => {
			(fsMock.stat as jest.Mock).mockResolvedValue({ isDirectory: () => false } as any);

			// start() now throws on error to signal failure to PluginServiceManagerService
			await expect(svc.start()).rejects.toThrow('Path is not a directory');

			expect(Logger.prototype.error).toHaveBeenCalledWith(
				expect.stringContaining('Rotating file logger disabled'),
				undefined,
				expect.anything(),
			);
			expect(scheduler.addCronJob).not.toHaveBeenCalled();
		});
	});

	describe('append', () => {
		beforeEach(async () => {
			await svc.start();
		});

		it('writes JSON line into today file when enabled and dir valid', async () => {
			const now = new Date('2025-10-20T10:11:12Z');
			jest.useFakeTimers().setSystemTime(now);

			await svc.append({ foo: 'bar' });

			const yyyy = '2025',
				mm = '10',
				dd = '20';
			const expectedFile = path.join(cfgRef.dir!, `${cfgRef.filePrefix}-${yyyy}-${mm}-${dd}.log`);

			expect(fsMock.appendFile).toHaveBeenCalledWith(expectedFile, JSON.stringify({ foo: 'bar' }) + '\n', 'utf8');

			jest.useRealTimers();
		});

		it('does not write when service is stopped', async () => {
			await svc.stop();

			await svc.append({ x: 1 });

			expect(fsMock.appendFile).not.toHaveBeenCalled();
		});

		it('swallows append error and logs', async () => {
			(fsMock.appendFile as jest.Mock).mockRejectedValueOnce(new Error('boom'));

			await svc.append({ foo: 'bar' });

			expect(Logger.prototype.error).toHaveBeenCalledWith(
				expect.stringContaining('Failed to append log'),
				undefined,
				expect.anything(),
			);
		});
	});

	describe('cleanup', () => {
		beforeEach(async () => {
			await svc.start();
		});

		it('removes files older than retentionDays; keeps recent and foreign files', async () => {
			const now = new Date('2025-10-20T00:00:00Z');

			jest.useFakeTimers().setSystemTime(now);

			cfgRef.retentionDays = 3;

			const prefix = `${cfgRef.filePrefix}-`;
			const files = [
				// too old
				{ name: `${prefix}2025-10-10.log`, isFile: () => true },
				// old (4 days ago -> remove)
				{ name: `${prefix}2025-10-16.log`, isFile: () => true },
				// within retention (3 days ago -> keep)
				{ name: `${prefix}2025-10-17.log`, isFile: () => true },
				// today
				{ name: `${prefix}2025-10-20.log`, isFile: () => true },
				// not matching
				{ name: `README.md`, isFile: () => true },
				// directory
				{ name: `${prefix}2025-10-14.log`, isFile: () => false },
			] as any[];

			(fsMock.readdir as jest.Mock).mockResolvedValueOnce(files);

			await svc.cleanup();

			// Should remove files strictly older than 2025-10-17
			expect(fsMock.rm).toHaveBeenCalledTimes(3);
			expect(fsMock.rm).toHaveBeenCalledWith(path.join(cfgRef.dir!, `${prefix}2025-10-10.log`));
			expect(fsMock.rm).toHaveBeenCalledWith(path.join(cfgRef.dir!, `${prefix}2025-10-16.log`));

			jest.useRealTimers();
		});

		it('no-ops when service is stopped', async () => {
			await svc.stop();

			await svc.cleanup();

			expect(fsMock.readdir).not.toHaveBeenCalled();
		});
	});

	describe('cron lifecycle', () => {
		it('re-registers cron when already present', async () => {
			(scheduler.doesExist as jest.Mock).mockReturnValueOnce(true);

			await svc.start();

			expect(scheduler.deleteCronJob).toHaveBeenCalledWith(cronName);
			expect(scheduler.addCronJob).toHaveBeenCalledTimes(1);
		});

		it('unregisterCleanupJob is called when service stops after being enabled', async () => {
			await svc.start();

			(scheduler.doesExist as unknown as jest.Mock).mockReturnValue(true);

			cfgRef.enabled = false;

			await svc.stop();

			expect(scheduler.deleteCronJob).toHaveBeenCalledWith(cronName);
		});
	});

	describe('onConfigChanged', () => {
		it('clears cached plugin config', async () => {
			await svc.start();

			// onConfigChanged just clears the cached config
			// Re-initialization happens through PluginServiceManagerService
			await svc.onConfigChanged();

			// Service should still be in started state
			expect(svc.getState()).toBe('started');
		});
	});

	describe('dir default path', () => {
		it('uses fallback when dir is empty string', async () => {
			cfgRef.dir = '';

			await svc.start();

			expect(fsMock.mkdir).toHaveBeenCalled();
		});
	});
});
