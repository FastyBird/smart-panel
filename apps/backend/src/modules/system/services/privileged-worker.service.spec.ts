/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EventEmitter } from 'events';
import { existsSync, readFileSync } from 'fs';
import { spawn } from 'node:child_process';

import { PlatformType } from '../../platform/platform.constants';
import { PlatformService } from '../../platform/services/platform.service';
import { PrivilegedWorkerUnavailableException } from '../system.exceptions';

import { PrivilegedJobSpec, PrivilegedJobStatus, PrivilegedWorkerService } from './privileged-worker.service';

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

		it('releases the unit immediately when spawn() throws synchronously, without waiting for the timeout', async () => {
			(spawn as jest.Mock).mockImplementationOnce(() => {
				throw new Error('EAGAIN: resource temporarily unavailable');
			});

			await expect(service.run(baseSpec)).rejects.toThrow('EAGAIN');

			// No timer advance — the unit must already be free.
			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it("releases the unit immediately when the child emits 'error', without waiting for the timeout", async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.emit('error', new Error('spawn sudo ENOENT'));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'failed', message: expect.stringContaining('ENOENT') }),
			);

			// No timer advance — the unit must already be free.
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

			// updatedAt is service-owned (see the 'field ownership' describe block below), so it
			// is deliberately not asserted against the fixture's value here.
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'running', step: 'downloading' }));
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

		it('allows a handler to unsubscribe itself from within its own invocation without throwing', async () => {
			// This is exactly how UpdateExecutorService consumes onStatus: the handler decides a
			// status is terminal and calls the unsubscribe it closed over, from inside its own
			// invocation. Unsubscribing no longer frees the unit itself (see the 'onStatus'
			// describe block below) — this only asserts that self-unsubscription is safe and
			// still delivers the tick it was triggered by.
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

			expect(() => jest.advanceTimersByTime(3_000)).not.toThrow();

			expect(seen).toEqual(['complete']);
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

		it('keeps the unit reserved after every handler unsubscribes while the job is still running', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			const unsubscribe = service.onStatus(id, handler);

			unsubscribe();

			// No terminal status has been observed — unsubscribing must not free the unit, so a
			// second run for the same unit is still rejected.
			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			// Now free — the (mapped/native) status reached a terminal state on its own.
			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it('returns a no-op unsubscribe for an unknown job id', () => {
			expect(() => service.onStatus('unknown-id', jest.fn())()).not.toThrow();
		});

		it('replays the current status to a handler that subscribes after the job already completed', async () => {
			// The race this closes: run() resolves, then — before the caller gets
			// around to calling onStatus() — the job reaches a terminal state via
			// a poll tick or the child's own exit handler. Without a replay, a
			// handler registered afterwards would never learn the job even ran.
			const { id } = await service.run(baseSpec);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			const handler = jest.fn();

			service.onStatus(id, handler);

			await Promise.resolve();

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'complete' }));

			// Terminal and already released — nothing can ever deliver to this
			// handler again, so advancing time further must not call it twice.
			jest.advanceTimersByTime(60_000);

			expect(handler).toHaveBeenCalledTimes(1);
		});

		it('replays the current running status once, then still delivers a later real tick exactly once (no duplicate delivery)', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			// Subscribes immediately after run() resolves, before any poll tick —
			// the normal calling convention every consumer (UpdateExecutorService,
			// TailscaleSetupService) uses.
			service.onStatus(id, handler);

			await Promise.resolve();

			// The replay of run()'s own initial snapshot — no step/message yet,
			// since no status file has been read.
			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'running' }));

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'running', step: 'downloading', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			// A distinct, later tick — delivered once, not duplicated by the replay.
			expect(handler).toHaveBeenCalledTimes(2);
			expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ id, state: 'running', step: 'downloading' }));
		});

		it('does not deliver the replay to a handler that unsubscribed synchronously, before the microtask ran', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			const unsubscribe = service.onStatus(id, handler);

			unsubscribe();

			await Promise.resolve();

			expect(handler).not.toHaveBeenCalled();
		});

		it("does not double-deliver to a handler subscribed re-entrantly from within another handler's own delivery", async () => {
			// Set iteration is live: without snapshotting record.handlers before
			// the delivery loop, a handler added mid-loop (by another handler
			// calling onStatus() re-entrantly, from inside its own invocation)
			// would be visited by *this same* loop *and* separately receive its
			// own scheduled replay — the same status delivered twice.
			const { id } = await service.run(baseSpec);

			const handlerB = jest.fn();

			// Only subscribes handlerB from the 'downloading' tick — not from
			// its own initial replay (state: 'running', no step) — so the
			// re-entrant subscription happens from inside the live delivery
			// loop this test is targeting, not from an unrelated microtask.
			const handlerA = jest.fn((status: PrivilegedJobStatus) => {
				if (status.step === 'downloading') {
					service.onStatus(id, handlerB);
				}
			});

			service.onStatus(id, handlerA);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'running', step: 'downloading', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			// handlerA ran synchronously inside this tick's (snapshotted)
			// delivery loop and subscribed handlerB from within it — handlerB
			// must not also be visited by that same, already-snapshotted loop.
			expect(handlerB).not.toHaveBeenCalled();

			await Promise.resolve();

			// handlerB's own replay delivers the current status — exactly once.
			expect(handlerB).toHaveBeenCalledTimes(1);
			expect(handlerB).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'running', step: 'downloading' }));
		});
	});

	describe('child process exit', () => {
		it('marks the job failed when the child exits with a non-zero code before any status file exists', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.emit('exit', 1, null);

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'failed', message: expect.stringContaining('1') }),
			);
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'failed' }));

			// Unit is free again — no need to wait for the timeout.
			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it('marks the job failed when the child is terminated by a signal before any status file exists', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.emit('exit', null, 'SIGKILL');

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'failed', message: expect.stringContaining('SIGKILL') }),
			);
		});

		it('does nothing on a zero exit after the job already completed via its status file', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			handler.mockClear();

			fakeChild.emit('exit', 0, null);

			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'complete' }));
		});

		it('does not override an already-complete status when the child later exits with a non-zero code', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			handler.mockClear();

			fakeChild.emit('exit', 1, null);

			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'complete' }));
		});

		it('never lets a stale event from an old record evict a newer unit reservation', async () => {
			const oldChild = fakeChild;

			const { id: oldId } = await service.run(baseSpec);

			// error finishes the old job and frees the unit ...
			oldChild.emit('error', new Error('boom'));
			expect(service.getStatus(oldId)).toEqual(expect.objectContaining({ state: 'failed' }));

			// ... exit right after is a no-op (idempotent finish — already terminal).
			oldChild.emit('exit', 0, null);
			expect(service.getStatus(oldId)).toEqual(expect.objectContaining({ state: 'failed' }));

			// A newer job now reserves the same unit, with its own child.
			const newChild = Object.assign(new EventEmitter(), { unref: jest.fn(), pid: 5151 }) as FakeChild;
			(spawn as jest.Mock).mockReturnValueOnce(newChild);

			const { id: newId } = await service.run(baseSpec);
			expect(newId).not.toBe(oldId);

			// A stale event fires on the OLD child/record after the newer job has already started.
			oldChild.emit('exit', 1, null);
			oldChild.emit('error', new Error('late'));

			// The newer job's own status is untouched, and its unit reservation survived: a third
			// run for the same unit is still rejected.
			expect(service.getStatus(newId)).toEqual(expect.objectContaining({ state: 'running' }));
			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
		});
	});

	describe('mapStatus', () => {
		it('applies the mapper to translate a caller-specific status shape before terminal detection', async () => {
			const mapStatus = jest.fn((raw: Record<string, unknown>): Partial<PrivilegedJobStatus> | null => {
				const legacyStatus = raw.legacyStatus as string | undefined;

				if (!legacyStatus) {
					return null;
				}

				const state: PrivilegedJobStatus['state'] =
					legacyStatus === 'done' ? 'complete' : legacyStatus === 'error' ? 'failed' : 'running';

				return { state, step: raw.legacyPhase as string | undefined };
			});

			const { id } = await service.run({ ...baseSpec, mapStatus });
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ legacyStatus: 'in-progress', legacyPhase: 'downloading' }),
			);

			jest.advanceTimersByTime(3_000);

			expect(mapStatus).toHaveBeenCalledWith({ legacyStatus: 'in-progress', legacyPhase: 'downloading' });
			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'running', step: 'downloading' }));

			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ legacyStatus: 'done' }));

			jest.advanceTimersByTime(3_000);

			expect(handler).toHaveBeenLastCalledWith(expect.objectContaining({ id, state: 'complete' }));

			// Terminal via the mapped state — the unit is free without needing unsubscribe/timeout.
			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it('skips a tick when the mapper returns null (not a valid status yet)', async () => {
			const mapStatus = jest.fn().mockReturnValue(null);

			const { id } = await service.run({ ...baseSpec, mapStatus });
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ whatever: true }));

			jest.advanceTimersByTime(3_000);

			expect(mapStatus).toHaveBeenCalled();
			expect(handler).not.toHaveBeenCalled();
		});

		it('treats a throwing mapStatus as an invalid tick instead of crashing the poll loop', async () => {
			const mapStatus = jest.fn(() => {
				throw new Error('boom');
			});

			const { id } = await service.run({ ...baseSpec, mapStatus });
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ whatever: true }));

			expect(() => jest.advanceTimersByTime(3_000)).not.toThrow();

			expect(mapStatus).toHaveBeenCalled();
			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'running' })); // unchanged

			// A throwing mapper never counts as a terminal status — the unit stays reserved.
			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
		});

		it('logs the throwing mapper at most once per job across repeated bad ticks', async () => {
			const mapStatus = jest.fn(() => {
				throw new Error('boom');
			});
			const { id } = await service.run({ ...baseSpec, mapStatus });
			const debugSpy = jest.spyOn(service['logger'], 'debug');

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ whatever: true }));

			jest.advanceTimersByTime(3_000);
			jest.advanceTimersByTime(3_000);

			expect(debugSpy).toHaveBeenCalledTimes(1);
			expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining(id));
		});
	});

	describe('status field ownership and validation', () => {
		it('ignores a tick with a missing state, leaving the previous status and the unit reservation in place', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ step: 'downloading' })); // no `state` at all

			jest.advanceTimersByTime(3_000);

			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'running' })); // unchanged

			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
		});

		it('ignores a tick with a state outside the valid set, leaving the previous status and the unit reservation in place', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'in-progress' })); // not a recognized tick state

			jest.advanceTimersByTime(3_000);

			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'running' })); // unchanged

			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
		});

		it('rejects state: "timeout" from a file/mapper — that value is reserved for the service itself', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'timeout' }));

			jest.advanceTimersByTime(3_000);

			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'running' })); // not hijacked

			// Ignored, not accepted as terminal — the unit stays reserved.
			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
		});

		it('logs an unusable status at most once per job, even across several bad ticks in a row', async () => {
			const { id } = await service.run(baseSpec);
			const debugSpy = jest.spyOn(service['logger'], 'debug');

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'bogus' }));

			jest.advanceTimersByTime(3_000);
			jest.advanceTimersByTime(3_000);
			jest.advanceTimersByTime(3_000);

			expect(debugSpy).toHaveBeenCalledTimes(1);
			expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining(id));
		});

		it('lets a native-shaped status file drive the job to complete and release the unit', async () => {
			const { id } = await service.run(baseSpec); // no mapStatus — native { state, step?, message? } shape

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'complete' }));

			jest.advanceTimersByTime(3_000);

			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'complete' }));

			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it('owns id and updatedAt even when the status file disagrees', async () => {
			const { id } = await service.run(baseSpec);
			let delivered: PrivilegedJobStatus | undefined;

			service.onStatus(id, (status) => {
				delivered = status;
			});

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id: 'a-completely-different-id', state: 'running', updatedAt: '1999-01-01T00:00:00.000Z' }),
			);

			jest.advanceTimersByTime(3_000);

			expect(delivered?.id).toBe(id); // the job's own id, not the file's
			expect(delivered?.updatedAt).not.toBe('1999-01-01T00:00:00.000Z');
			expect(service.getStatus(id)?.id).toBe(id);
			expect(service.getStatus(id)?.updatedAt).not.toBe('1999-01-01T00:00:00.000Z');
		});

		it('drops non-string step/message values from the file instead of forwarding them', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ state: 'running', step: 42, message: { oops: true } }),
			);

			jest.advanceTimersByTime(3_000);

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'running', step: undefined, message: undefined }),
			);
		});
	});
});
