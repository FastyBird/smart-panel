/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'node:child_process';

import { PlatformType } from '../../platform/platform.constants';
import { PlatformService } from '../../platform/services/platform.service';
import { PrivilegedWorkerUnavailableException } from '../system.exceptions';

import { PrivilegedJobSpec, PrivilegedWorkerService } from './privileged-worker.service';

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
}));

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	spawn: jest.fn(),
}));

type FakeChild = EventEmitter & { unref: jest.Mock; pid: number };

describe('PrivilegedWorkerService', () => {
	let service: PrivilegedWorkerService;
	let platformService: { supportsPrivilegedWorkers: jest.Mock; getPlatformType: jest.Mock };
	let fakeChild: FakeChild;

	const baseSpec: PrivilegedJobSpec = {
		unit: 'smart-panel-test',
		script: '/opt/smart-panel/scripts/test-worker.sh',
		args: ['1.2.3'],
		env: { FOO: 'bar' },
		statusFile: '/var/lib/smart-panel/test-status.json',
	};

	beforeEach(() => {
		jest.useFakeTimers();

		fakeChild = Object.assign(new EventEmitter(), { unref: jest.fn(), pid: 4242 }) as FakeChild;

		(spawn as jest.Mock).mockReturnValue(fakeChild);
		(existsSync as jest.Mock).mockReturnValue(false);
		(readFileSync as jest.Mock).mockReturnValue('');

		platformService = {
			supportsPrivilegedWorkers: jest.fn().mockResolvedValue(true),
			getPlatformType: jest.fn().mockReturnValue(PlatformType.RASPBERRY),
		};

		service = new PrivilegedWorkerService(platformService as unknown as PlatformService);
	});

	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.clearAllMocks();
	});

	describe('run', () => {
		it('spawns the worker through sudo/systemd-run with the expected arguments', async () => {
			await service.run(baseSpec);

			expect(spawn).toHaveBeenCalledWith(
				'sudo',
				[
					'-n',
					'systemd-run',
					'--scope',
					'--unit=smart-panel-test',
					'--setenv',
					'FOO=bar',
					'bash',
					'/opt/smart-panel/scripts/test-worker.sh',
					'1.2.3',
				],
				{ detached: true, stdio: 'ignore' },
			);
			expect(fakeChild.unref).toHaveBeenCalled();
		});

		it('resolves with a generated job id', async () => {
			const { id } = await service.run(baseSpec);

			expect(typeof id).toBe('string');
			expect(id.length).toBeGreaterThan(0);
		});

		it('spawns without --setenv flags when no env is given', async () => {
			await service.run({ ...baseSpec, env: undefined });

			expect(spawn).toHaveBeenCalledWith(
				'sudo',
				[
					'-n',
					'systemd-run',
					'--scope',
					'--unit=smart-panel-test',
					'bash',
					'/opt/smart-panel/scripts/test-worker.sh',
					'1.2.3',
				],
				{ detached: true, stdio: 'ignore' },
			);
		});

		it('throws PrivilegedWorkerUnavailableException when the platform does not support privileged workers', async () => {
			platformService.supportsPrivilegedWorkers.mockResolvedValue(false);

			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
			expect(spawn).not.toHaveBeenCalled();
		});

		it('throws PrivilegedWorkerUnavailableException for a second run on a busy unit', async () => {
			await service.run(baseSpec);

			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
			expect(spawn).toHaveBeenCalledTimes(1);
		});

		it('allows a run for a different unit while the first is still busy', async () => {
			await service.run(baseSpec);

			await expect(service.run({ ...baseSpec, unit: 'smart-panel-other' })).resolves.toEqual(
				expect.objectContaining({ id: expect.any(String) }),
			);
		});

		it('allows a new run for the same unit once the previous job reaches a terminal state', async () => {
			const { id } = await service.run(baseSpec);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});
	});

	describe('status polling', () => {
		it('notifies subscribers with the parsed status file contents every 3 seconds', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'running', step: 'downloading', updatedAt: '2026-01-01T00:00:00.000Z' }),
			);

			jest.advanceTimersByTime(3_000);

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'running', step: 'downloading', updatedAt: '2026-01-01T00:00:00.000Z' }),
			);
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ id, state: 'running', step: 'downloading' }));
		});

		it('does not notify while the status file does not exist yet', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(false);

			jest.advanceTimersByTime(3_000);

			expect(handler).not.toHaveBeenCalled();
		});

		it('retries on the next tick when the status file is mid-write (invalid JSON)', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue('not valid json');

			jest.advanceTimersByTime(3_000);

			expect(handler).not.toHaveBeenCalled();

			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'running', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('stops polling once the file reports a terminal state', async () => {
			const { id } = await service.run(baseSpec);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			(readFileSync as jest.Mock).mockClear();

			jest.advanceTimersByTime(30_000);

			expect(readFileSync).not.toHaveBeenCalled();
		});

		it('supports a handler that unsubscribes itself when it observes a terminal state', async () => {
			// This is exactly how UpdateExecutorService consumes onStatus: the handler decides
			// a status is terminal (reading fields PrivilegedWorkerService does not interpret
			// itself) and calls the unsubscribe it closed over, from inside its own invocation.
			const { id } = await service.run(baseSpec);
			const seen: string[] = [];

			const unsubscribe = service.onStatus(id, (status) => {
				seen.push(status.state);

				if (status.state === 'complete') {
					unsubscribe();
				}
			});

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			expect(seen).toEqual(['complete']);

			// The unit is free immediately — no need to wait for the timeout.
			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});
	});

	describe('timeout', () => {
		it('reports a timeout state and frees the unit once the hard timeout elapses', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });
			const handler = jest.fn();

			service.onStatus(id, handler);

			jest.advanceTimersByTime(6_001);

			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'timeout' }));
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'timeout' }));

			await expect(service.run({ ...baseSpec, timeoutMs: 5_000 })).resolves.toEqual(
				expect.objectContaining({ id: expect.any(String) }),
			);
		});

		it('stops polling the status file once timed out', async () => {
			await service.run({ ...baseSpec, timeoutMs: 5_000 });

			jest.advanceTimersByTime(6_001);

			(readFileSync as jest.Mock).mockClear();
			(existsSync as jest.Mock).mockReturnValue(true);

			jest.advanceTimersByTime(30_000);

			expect(readFileSync).not.toHaveBeenCalled();
		});
	});

	describe('getStatus', () => {
		it('returns null for an unknown job id', () => {
			expect(service.getStatus('unknown-id')).toBeNull();
		});

		it('returns a running status right after spawning, before any poll tick', async () => {
			const { id } = await service.run(baseSpec);

			expect(service.getStatus(id)).toEqual(expect.objectContaining({ id, state: 'running' }));
		});
	});

	describe('onStatus', () => {
		it('stops delivering notifications after unsubscribe', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			const unsubscribe = service.onStatus(id, handler);

			unsubscribe();

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'running', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			expect(handler).not.toHaveBeenCalled();
		});

		it('frees the unit once the last subscriber unsubscribes, without waiting for a poll tick', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			const unsubscribe = service.onStatus(id, handler);

			// Same unit is still busy while a subscriber is watching it
			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);

			unsubscribe();

			// Unsubscribing the last handler releases the unit immediately
			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it('returns a no-op unsubscribe for an unknown job id', () => {
			expect(() => service.onStatus('unknown-id', jest.fn())()).not.toThrow();
		});
	});
});
