/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { EventEmitter } from 'events';
import { closeSync, existsSync, openSync, readFileSync, readSync, watch } from 'fs';
import { execFile, spawn } from 'node:child_process';

import { PlatformType } from '../../platform/platform.constants';
import { PlatformService } from '../../platform/services/platform.service';
import { PrivilegedWorkerUnavailableException } from '../system.exceptions';

import { PrivilegedJobSpec, PrivilegedJobStatus, PrivilegedWorkerService } from './privileged-worker.service';

jest.mock('fs', () => ({
	...jest.requireActual<typeof import('fs')>('fs'),
	existsSync: jest.fn(),
	readFileSync: jest.fn(),
	openSync: jest.fn(),
	readSync: jest.fn(),
	closeSync: jest.fn(),
	watch: jest.fn(),
}));

jest.mock('node:child_process', () => ({
	...jest.requireActual<typeof import('node:child_process')>('node:child_process'),
	spawn: jest.fn(),
	execFile: jest.fn(),
}));

type FakeStderr = EventEmitter & { unref: jest.Mock };
type FakeChild = EventEmitter & { unref: jest.Mock; pid: number; stderr: FakeStderr };

type ExecFileCallback = (error: Error | null, stdout?: string, stderr?: string) => void;

function createFakeChild(pid: number): FakeChild {
	const stderr = Object.assign(new EventEmitter(), { unref: jest.fn() }) as FakeStderr;

	return Object.assign(new EventEmitter(), { unref: jest.fn(), pid, stderr }) as FakeChild;
}

/**
 * Drains the real (unfaked, see the note on jest.useFakeTimers() above onStatus in the service
 * itself) Promise microtask queue several times over. The timeout-handling chain under test here
 * (stopUnit -> isUnitActive -> finishJob/notifyHandlers) is native-Promise-based, not timer-based,
 * so `jest.advanceTimersByTime` never resolves it — only awaiting real microtask ticks does. A
 * generous, fixed number of ticks is used rather than counting exact hops: once the chain has
 * settled, extra ticks are harmless no-ops.
 */
async function flushMicrotasks(times = 5): Promise<void> {
	for (let i = 0; i < times; i++) {
		await Promise.resolve();
	}
}

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

		fakeChild = createFakeChild(4242);

		(spawn as jest.Mock).mockReturnValue(fakeChild);
		(existsSync as jest.Mock).mockReturnValue(false);
		(readFileSync as jest.Mock).mockReturnValue('');
		(watch as jest.Mock).mockImplementation(() => {
			throw new Error('Unavailable');
		});
		// Default: the unit is confirmed stopped, so a bare timeout (no test-specific override)
		// still frees the unit exactly like before this change.
		(execFile as unknown as jest.Mock).mockImplementation(
			(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
				callback(null, 'inactive\n', '');
			},
		);

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

	describe('status history', () => {
		let watcher: EventEmitter & { close: jest.Mock; unref: jest.Mock };
		let onChange: (event: string, filename: string | null) => void;
		let file: string;

		const entries = [
			{ state: 'running', step: 'install', message: 'Installed' },
			{ state: 'running', step: 'daemon', message: 'Enabled' },
			{ state: 'running', step: 'operator', message: 'Granted' },
			{ state: 'complete', step: 'complete', message: 'Done' },
		];

		function publish(id: string, history = entries): void {
			file = JSON.stringify({ jobId: id, ...history[history.length - 1], history });
		}

		beforeEach(() => {
			file = '';
			watcher = Object.assign(new EventEmitter(), { close: jest.fn(), unref: jest.fn() });
			(watch as jest.Mock).mockImplementation((_path: string, callback: typeof onChange) => {
				onChange = callback;

				return watcher;
			});
			(existsSync as jest.Mock).mockReturnValue(true);
			(openSync as jest.Mock).mockReturnValue(42);
			(readSync as jest.Mock).mockImplementation((_fd: number, buffer: Buffer, offset: number, length: number) => {
				return Buffer.from(file).copy(buffer, offset, offset, offset + length);
			});
		});

		it('replays all coalesced stages before the first poll, then settles once', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });
			const handler = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, handler);
			await flushMicrotasks();
			handler.mockClear();
			publish(id);
			jest.advanceTimersByTime(3_000);

			expect(handler.mock.calls.map(([status]: [PrivilegedJobStatus]) => status.step)).toEqual([
				'install',
				'daemon',
				'operator',
				'complete',
			]);
			expect(handler.mock.calls.every(([status]: [PrivilegedJobStatus]) => status.id === id)).toBe(true);
			expect(watcher.close).toHaveBeenCalledTimes(1);
			expect(closeSync).toHaveBeenCalledWith(42);
			onChange('rename', 'test-status.json');
			jest.advanceTimersByTime(3_000);
			expect(handler).toHaveBeenCalledTimes(4);
			await expect(service.run(baseSpec)).resolves.toHaveProperty('id');
		});

		it('reads atomic rename promptly, ignores duplicates, and replays accepted history to a late subscriber', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			publish(id, entries.slice(0, 2));
			onChange('rename', 'unrelated.json');
			expect(service.getStatus(id)?.step).toBeUndefined();
			onChange('rename', 'test-status.json');
			expect(service.getStatus(id)?.step).toBe('daemon');
			const handler = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, handler);
			await flushMicrotasks();
			expect(handler.mock.calls.map(([status]: [PrivilegedJobStatus]) => status.step)).toEqual(['install', 'daemon']);
			onChange('rename', null);
			jest.advanceTimersByTime(3_000);
			expect(handler).toHaveBeenCalledTimes(2);
			publish(id);
			onChange('rename', 'test-status.json');
			expect(handler).toHaveBeenCalledTimes(4);
			expect(watcher.unref).toHaveBeenCalledTimes(1);
		});

		it('replays progress captured before subscription without a duplicate terminal event', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			publish(id);
			onChange('rename', 'test-status.json');
			const handler = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, handler);
			await flushMicrotasks();
			expect(handler).toHaveBeenCalledTimes(4);
			expect(handler.mock.calls[3][0].state).toBe('complete');
		});

		it('overrides caller job id env and rejects a previous job file when a unit is reused', async () => {
			const spec = { ...baseSpec, trackStatusHistory: true, env: { PRIVILEGED_WORKER_JOB_ID: 'spoof' } };
			const first = await service.run(spec);

			expect(((spawn as jest.Mock).mock.calls[0] as [string, string[]])[1]).toContain(
				`PRIVILEGED_WORKER_JOB_ID=${first.id}`,
			);
			expect(((spawn as jest.Mock).mock.calls[0] as [string, string[]])[1]).not.toContain(
				'PRIVILEGED_WORKER_JOB_ID=spoof',
			);
			publish(first.id);
			onChange('rename', null);
			const second = await service.run(spec);

			onChange('rename', null);
			expect(service.getStatus(second.id)?.state).toBe('running');
			expect(service.getStatus(second.id)?.step).toBeUndefined();
		});

		it.each([
			['missing job id', { ...entries[3], history: entries }],
			['empty history', { state: 'running', history: [] }],
			['null entry', { state: 'running', history: [null] }],
			['noncanonical state', { state: 'timeout', history: [{ state: 'timeout' }] }],
			['terminal in middle', { ...entries[0], history: [entries[3], entries[0]] }],
			['mismatched latest', { ...entries[0], history: entries }],
			['invalid step', { state: 'running', step: 42, history: [{ state: 'running', step: 42 }] }],
			['too many entries', { ...entries[0], history: Array.from({ length: 33 }, () => entries[0]) }],
		])('rejects %s without partial delivery', async (name, raw) => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			file = JSON.stringify({ jobId: name === 'missing job id' ? undefined : id, ...raw });
			onChange('rename', null);
			expect(service.getStatus(id)?.step).toBeUndefined();
			expect(service.getStatus(id)?.state).toBe('running');
		});

		it('rejects rewrites and truncation of an accepted prefix', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });
			const handler = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, handler);
			await flushMicrotasks();
			publish(id, entries.slice(0, 2));
			onChange('rename', null);
			handler.mockClear();
			publish(id, entries.slice(0, 1));
			onChange('rename', null);
			publish(id, [{ ...entries[0], message: 'Changed' }, entries[1]]);
			onChange('rename', null);
			expect(handler).not.toHaveBeenCalled();
			expect(service.getStatus(id)?.step).toBe('daemon');
		});

		it('bounds file reads and closes the fd on oversize input', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			file = ' '.repeat(64 * 1024 + 1);
			onChange('rename', null);
			expect(service.getStatus(id)?.step).toBeUndefined();
			expect(closeSync).toHaveBeenCalledWith(42);
			expect(((readSync as jest.Mock).mock.calls[0] as [number, Buffer, number, number])[3]).toBe(64 * 1024 + 1);
		});

		it('falls back to polling after watcher errors or setup failure', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			watcher.emit('error', new Error('Unavailable'));
			expect(watcher.close).toHaveBeenCalledTimes(1);
			publish(id);
			jest.advanceTimersByTime(3_000);
			expect(service.getStatus(id)?.state).toBe('complete');
			(watch as jest.Mock).mockImplementation(() => {
				throw new Error('Unavailable');
			});
			const second = await service.run({ ...baseSpec, trackStatusHistory: true });

			publish(second.id);
			jest.advanceTimersByTime(3_000);
			expect(service.getStatus(second.id)?.state).toBe('complete');
		});

		it.each(['error', 'exit'])('closes the watcher after child %s', async (event) => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			if (event === 'error') {
				fakeChild.emit('error', new Error('Failed'));
			} else {
				fakeChild.emit('exit', 1, null);
			}

			expect(watcher.close).toHaveBeenCalledTimes(1);
			publish(id);
			onChange('rename', null);
			expect(service.getStatus(id)?.state).toBe('failed');
		});

		it('closes the watcher at the deadline and cannot revive while the stop is in flight', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true, timeoutMs: 100 });

			jest.advanceTimersByTime(101);
			publish(id);
			onChange('rename', null);
			expect(watcher.close).toHaveBeenCalledTimes(1);
			onChange('rename', null);
			fakeChild.emit('exit', 0, null);
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('timeout');
			onChange('rename', null);
			expect(service.getStatus(id)?.state).toBe('timeout');
		});

		it('drains failed script history when a nonzero scope exit beats the watcher', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });
			const handler = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, handler);
			await flushMicrotasks();
			handler.mockClear();
			publish(id, [...entries.slice(0, 2), { state: 'failed', step: 'daemon', message: 'Refused' }]);
			fakeChild.emit('exit', 1, null);
			expect(handler.mock.calls.map(([status]: [PrivilegedJobStatus]) => status.step)).toEqual([
				'install',
				'daemon',
				'daemon',
			]);
			expect(service.getStatus(id)?.message).toBe('Refused');
			expect(watcher.close).toHaveBeenCalledTimes(1);
		});

		it('replays service-owned timeout once after accepted progress while retaining an active unit', async () => {
			(execFile as unknown as jest.Mock).mockImplementation(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) =>
					callback(null, 'active'),
			);
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true, timeoutMs: 100 });

			publish(id, entries.slice(0, 1));
			onChange('rename', null);
			jest.advanceTimersByTime(101);
			onChange('rename', null);
			fakeChild.emit('exit', 0, null);
			await flushMicrotasks();
			const handler = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, handler);
			await flushMicrotasks();
			expect(handler.mock.calls.map(([status]: [PrivilegedJobStatus]) => status.state)).toEqual(['running', 'timeout']);
			expect(watcher.close).toHaveBeenCalledTimes(1);
			await expect(service.run(baseSpec)).rejects.toThrow('still running');
		});

		it('isolates a throwing subscriber during replay and batch delivery so other subscribers and cleanup still finish', async () => {
			const { id } = await service.run({ ...baseSpec, trackStatusHistory: true });

			publish(id, entries.slice(0, 1));
			onChange('rename', null);
			const throwing = jest.fn<void, [PrivilegedJobStatus]>(() => {
				throw new Error('Subscriber failed');
			});
			const healthy = jest.fn<void, [PrivilegedJobStatus]>();

			service.onStatus(id, throwing);
			service.onStatus(id, healthy);
			await flushMicrotasks();
			expect(throwing).toHaveBeenCalledTimes(1);
			publish(id);
			onChange('rename', null);
			expect(throwing).toHaveBeenCalledTimes(4);
			expect(healthy.mock.calls.map(([status]) => status.step)).toEqual(['install', 'daemon', 'operator', 'complete']);
			expect(service.getStatus(id)?.state).toBe('complete');
			expect(watcher.close).toHaveBeenCalledTimes(1);
			await expect(service.run(baseSpec)).resolves.toHaveProperty('id');
		});

		it('rejects mapping plus history before spawning', async () => {
			await expect(service.run({ ...baseSpec, trackStatusHistory: true, mapStatus: () => null })).rejects.toThrow(
				'Status history cannot be combined with mapStatus',
			);
			expect(spawn).not.toHaveBeenCalled();
		});
	});

	describe('run', () => {
		it('keeps a transient service reserved after the launcher exits until the worker reports completion', async () => {
			const spec: PrivilegedJobSpec = { ...baseSpec, unitType: 'service' };
			const { id } = await service.run(spec);

			expect(spawn).toHaveBeenCalledWith(
				'sudo',
				[
					'-n',
					'systemd-run',
					'--collect',
					'--service-type=exec',
					'--unit=smart-panel-test',
					'--setenv',
					'FOO=bar',
					'bash',
					'/opt/smart-panel/scripts/test-worker.sh',
					'1.2.3',
				],
				{ detached: true, stdio: ['ignore', 'ignore', 'pipe'] },
			);
			fakeChild.emit('exit', 0, null);
			expect(service.getStatus(id)?.state).toBe('running');
			await expect(service.run(spec)).rejects.toThrow(PrivilegedWorkerUnavailableException);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'complete' }));
			jest.advanceTimersByTime(3_000);
			expect(service.getStatus(id)?.state).toBe('complete');
			await expect(service.run(spec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

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
				{ detached: true, stdio: ['ignore', 'ignore', 'pipe'] },
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
				{ detached: true, stdio: ['ignore', 'ignore', 'pipe'] },
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

	describe('independent service settlement', () => {
		const spec: PrivilegedJobSpec = { ...baseSpec, unitType: 'service' };

		it.each([
			['inactive', 3],
			['failed', 3],
			['unknown', 4],
		])('reports a %s worker without a terminal file and releases its reservation', async (state, code) => {
			(execFile as unknown as jest.Mock).mockImplementation(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					callback(Object.assign(new Error('Unit stopped'), { code }), `${state}\n`);
				},
			);
			const { id } = await service.run(spec);
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(3_000);
			await flushMicrotasks();

			expect(service.getStatus(id)).toEqual(
				expect.objectContaining({
					state: 'failed',
					message: expect.stringContaining('stopped without reporting completion'),
				}),
			);
			await expect(service.run(spec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it.each([
			['active', null],
			['deactivating', 3],
			['', 'ETIMEDOUT'],
			['inactive', 'EACCES'],
			['malformed', 3],
		])('keeps the reservation for an active or unverified worker (%s, %s)', async (state, code) => {
			(execFile as unknown as jest.Mock).mockImplementation(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					callback(code === null ? null : Object.assign(new Error('Probe failed'), { code }), `${state}\n`);
				},
			);
			const { id } = await service.run(spec);
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(3_000);
			await flushMicrotasks();

			expect(service.getStatus(id)?.state).toBe('running');
			await expect(service.run(spec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
		});

		it('retries a synchronously failed probe without releasing the reservation', async () => {
			(execFile as unknown as jest.Mock).mockImplementationOnce(() => {
				throw new Error('EAGAIN');
			});
			const { id } = await service.run(spec);
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(3_000);
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('running');
			await expect(service.run(spec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
			jest.advanceTimersByTime(3_000);
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('failed');
		});

		it('does not probe before systemd confirms launch or for a scope', async () => {
			await service.run(spec);
			jest.advanceTimersByTime(3_000);
			expect(execFile).not.toHaveBeenCalled();
			await service.run({ ...baseSpec, unit: 'another-scope' });
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(3_000);
			await flushMicrotasks();
			expect(execFile).toHaveBeenCalledTimes(1);
			expect(execFile).toHaveBeenCalledWith(
				'systemctl',
				['is-active', spec.unit],
				expect.any(Object),
				expect.any(Function),
			);
		});

		it('re-reads a terminal file published while the unit probe is pending', async () => {
			let reply: ExecFileCallback;
			(execFile as unknown as jest.Mock).mockImplementation(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					reply = callback;
				},
			);
			const { id } = await service.run(spec);
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(6_000);
			expect(execFile).toHaveBeenCalledTimes(1);
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'complete' }));
			reply(Object.assign(new Error('Collected'), { code: 4 }), 'unknown');
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('complete');
		});

		it('does not let a pending settlement probe override timeout handling', async () => {
			let reply: ExecFileCallback;
			(execFile as unknown as jest.Mock).mockImplementationOnce(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					reply = callback;
				},
			);
			const { id } = await service.run({ ...spec, timeoutMs: 6_000 });
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(9_000);
			// The timeout has taken ownership, but its stop command has not completed yet.
			reply(Object.assign(new Error('Collected'), { code: 4 }), 'unknown');
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('running');
			fakeChild.emit('exit', 0, null);
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('timeout');
		});

		it('ignores a late probe after terminal status and cannot release the next job', async () => {
			let reply: ExecFileCallback;
			(execFile as unknown as jest.Mock).mockImplementation(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					reply = callback;
				},
			);
			const { id } = await service.run(spec);
			fakeChild.emit('exit', 0, null);
			jest.advanceTimersByTime(3_000);
			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(JSON.stringify({ state: 'complete' }));
			jest.advanceTimersByTime(3_000);
			(existsSync as jest.Mock).mockReturnValue(false);
			const next = await service.run(spec);
			reply(Object.assign(new Error('Collected'), { code: 4 }), 'unknown');
			await flushMicrotasks();
			expect(service.getStatus(id)?.state).toBe('complete');
			expect(service.getStatus(next.id)?.state).toBe('running');
			await expect(service.run(spec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
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
		it('attempts to stop the still-running scope, then reads systemctl is-active, before finishing a timed-out job', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });

			const stopChild = createFakeChild(9001);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);

			jest.advanceTimersByTime(6_001);

			// The stop-attempt scope is spawned synchronously, as its own array of argv — no
			// shell string building — reusing the same `systemd-run *` sudoers grant run() uses.
			expect(spawn).toHaveBeenLastCalledWith(
				'sudo',
				[
					'-n',
					'systemd-run',
					'--scope',
					'--quiet',
					'--unit=smart-panel-test-stop',
					'systemctl',
					'stop',
					'smart-panel-test',
				],
				{ stdio: 'ignore' },
			);

			// The is-active read only happens after the stop attempt's own process settles.
			expect(execFile).not.toHaveBeenCalled();

			stopChild.emit('exit', 0, null);
			await flushMicrotasks();

			expect(execFile).toHaveBeenCalledWith(
				'systemctl',
				['is-active', 'smart-panel-test'],
				expect.objectContaining({ timeout: expect.any(Number) }),
				expect.any(Function),
			);
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'timeout' }));
		});

		it('gives up waiting on a stop attempt that never settles and still runs the is-active read (a scope that refuses to stop must not strand the job)', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });

			const stopChild = createFakeChild(9001);

			(spawn as jest.Mock).mockReturnValueOnce(stopChild);

			jest.advanceTimersByTime(6_001);

			expect(execFile).not.toHaveBeenCalled();

			// The stop child never emits 'exit' or 'error' - only the internal bound-wait timer
			// (STOP_ATTEMPT_TIMEOUT_MS) settles the stop attempt.
			jest.advanceTimersByTime(15_000);
			await flushMicrotasks();

			expect(execFile).toHaveBeenCalledWith(
				'systemctl',
				['is-active', 'smart-panel-test'],
				expect.objectContaining({ timeout: expect.any(Number) }),
				expect.any(Function),
			);
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'timeout' }));
		});

		it('reports a timeout state and frees the unit once the stop attempt confirms the unit stopped', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });
			const handler = jest.fn();

			service.onStatus(id, handler);

			const stopChild = createFakeChild(9001);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);

			jest.advanceTimersByTime(6_001);

			stopChild.emit('exit', 0, null);
			await flushMicrotasks();

			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'timeout' }));
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'timeout' }));

			await expect(service.run({ ...baseSpec, timeoutMs: 5_000 })).resolves.toEqual(
				expect.objectContaining({ id: expect.any(String) }),
			);
		});

		it('stops polling the status file once timed out', async () => {
			await service.run({ ...baseSpec, timeoutMs: 5_000 });

			const stopChild = createFakeChild(9001);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);

			jest.advanceTimersByTime(6_001);

			stopChild.emit('exit', 0, null);
			await flushMicrotasks();

			(readFileSync as jest.Mock).mockClear();
			(existsSync as jest.Mock).mockReturnValue(true);

			jest.advanceTimersByTime(30_000);

			expect(readFileSync).not.toHaveBeenCalled();
		});

		it('still runs the is-active check and frees the unit when the stop attempt itself errors but the unit already stopped on its own (race)', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });

			const stopChild = createFakeChild(9002);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);

			jest.advanceTimersByTime(6_001);

			// sudo/systemd-run itself refuses the stop-attempt invocation — must not crash the
			// flow or skip the is-active confirmation that follows.
			stopChild.emit('error', new Error('sudo: a password is required'));
			await flushMicrotasks();

			expect(execFile).toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'timeout' }));

			await expect(service.run(baseSpec)).resolves.toEqual(expect.objectContaining({ id: expect.any(String) }));
		});

		it('still runs the is-active check and frees the unit when spawn() itself throws synchronously for the stop attempt', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });

			(spawn as jest.Mock).mockImplementationOnce(() => {
				throw new Error('EAGAIN: resource temporarily unavailable');
			});

			jest.advanceTimersByTime(6_001);
			await flushMicrotasks();

			expect(execFile).toHaveBeenCalled();
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ state: 'timeout' }));
		});

		it('keeps the unit reserved and reports an explicit "still running" message when the unit is still active after the stop attempt', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });
			const handler = jest.fn();

			service.onStatus(id, handler);

			const stopChild = createFakeChild(9003);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);
			(execFile as unknown as jest.Mock).mockImplementationOnce(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					callback(null, 'active\n', '');
				},
			);

			jest.advanceTimersByTime(6_001);

			stopChild.emit('exit', 0, null);
			await flushMicrotasks();

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'timeout', message: expect.stringContaining('still running') }),
			);
			expect(service.getStatus(id)).toEqual(
				expect.objectContaining({ state: 'timeout', message: expect.stringContaining('still running') }),
			);

			// Not freed — a retry for the same unit must be rejected with wording that clearly
			// distinguishes this from an ordinary "already busy" rejection.
			await expect(service.run(baseSpec)).rejects.toThrow(PrivilegedWorkerUnavailableException);
			await expect(service.run(baseSpec)).rejects.toThrow(/still running/);
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
			const newChild = createFakeChild(5151);
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

	describe('stderr capture', () => {
		it('unrefs the stderr pipe right after spawning, so it cannot keep the process alive on its own', async () => {
			await service.run(baseSpec);

			expect(fakeChild.stderr.unref).toHaveBeenCalled();
		});

		it('includes the captured stderr and a generic message when the child exits non-zero, without the sudoers remediation', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.stderr.emit('data', Buffer.from('some script failure\n'));
			fakeChild.emit('exit', 1, null);

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					id,
					state: 'failed',
					stderr: 'some script failure\n',
					message: expect.stringContaining('some script failure'),
				}),
			);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					message: expect.not.stringContaining('sudo smart-panel-service install'),
				}),
			);
		});

		it('includes the captured stderr when the child emits an error', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.stderr.emit('data', Buffer.from('sudo: a password is required\n'));
			fakeChild.emit('error', new Error('spawn sudo ENOENT'));

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'failed', stderr: 'sudo: a password is required\n' }),
			);
		});

		it('includes the stderr captured so far in a hard-timeout status', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });

			fakeChild.stderr.emit('data', Buffer.from('still installing...\n'));

			// A distinct child for the stop-attempt spawn — reusing fakeChild here would also
			// fire the main job's own 'exit' handler when emitting below.
			const stopChild = createFakeChild(9004);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);

			jest.advanceTimersByTime(6_001);

			stopChild.emit('exit', 0, null);
			await flushMicrotasks();

			expect(service.getStatus(id)).toEqual(
				expect.objectContaining({ state: 'timeout', stderr: 'still installing...\n' }),
			);
		});

		it('omits stderr when nothing was ever written to it', async () => {
			const { id } = await service.run(baseSpec);
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.emit('exit', 1, null);

			expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id, state: 'failed', stderr: undefined }));
		});

		it('caps the captured stderr at 4 KiB, dropping anything beyond that', async () => {
			const { id } = await service.run(baseSpec);

			fakeChild.stderr.emit('data', Buffer.alloc(4096, 'a'));
			fakeChild.stderr.emit('data', Buffer.from('overflow-should-be-dropped'));
			fakeChild.emit('exit', 1, null);

			const status = service.getStatus(id);

			expect(status?.stderr).toHaveLength(4096);
			expect(status?.stderr).not.toContain('overflow-should-be-dropped');
		});

		it('redacts the captured stderr line by line through the caller-supplied redact callback', async () => {
			const redact = jest.fn((line: string) => line.replace('tskey-secret-value', '[redacted]'));

			const { id } = await service.run({ ...baseSpec, redact });
			const handler = jest.fn();

			service.onStatus(id, handler);

			fakeChild.stderr.emit('data', Buffer.from('line one\ntskey-secret-value leaked\n'));
			fakeChild.emit('exit', 1, null);

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({ id, state: 'failed', stderr: 'line one\n[redacted] leaked\n' }),
			);
			expect(redact).toHaveBeenCalledWith('line one');
			expect(redact).toHaveBeenCalledWith('tskey-secret-value leaked');
		});
	});

	describe('job record pruning', () => {
		it('keeps a terminal job readable via getStatus() for a while, then prunes it once the retention window elapses', async () => {
			const { id } = await service.run(baseSpec);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);

			// Terminal, and still readable right after (the unit was just freed).
			expect(service.getStatus(id)).toEqual(expect.objectContaining({ id, state: 'complete' }));

			// Still readable well before the 5-minute retention window elapses.
			jest.advanceTimersByTime(4 * 60_000);

			expect(service.getStatus(id)).toEqual(expect.objectContaining({ id, state: 'complete' }));

			// The retention window has now elapsed since the job went terminal.
			jest.advanceTimersByTime(60_000 + 1);

			expect(service.getStatus(id)).toBeNull();
		});

		it('returns a no-op unsubscribe for a pruned job, matching the existing unknown-id behavior', async () => {
			const { id } = await service.run(baseSpec);

			(existsSync as jest.Mock).mockReturnValue(true);
			(readFileSync as jest.Mock).mockReturnValue(
				JSON.stringify({ id, state: 'complete', updatedAt: new Date().toISOString() }),
			);

			jest.advanceTimersByTime(3_000);
			jest.advanceTimersByTime(5 * 60_000 + 1);

			expect(service.getStatus(id)).toBeNull();
			expect(() => service.onStatus(id, jest.fn())()).not.toThrow();
		});

		it('does not prune a job still reserved in busyUnits after a timeout stop attempt (the RA-24 "still running" case)', async () => {
			const { id } = await service.run({ ...baseSpec, timeoutMs: 5_000 });

			const stopChild = createFakeChild(9010);
			(spawn as jest.Mock).mockReturnValueOnce(stopChild);
			(execFile as unknown as jest.Mock).mockImplementationOnce(
				(_file: string, _args: readonly string[], _options: unknown, callback: ExecFileCallback) => {
					callback(null, 'active\n', '');
				},
			);

			jest.advanceTimersByTime(6_001);

			stopChild.emit('exit', 0, null);
			await flushMicrotasks();

			expect(service.getStatus(id)).toEqual(expect.objectContaining({ id, state: 'timeout' }));

			// Advance well past the normal 5-minute prune window — the job must still be reserved
			// and readable, since its unit was never actually freed (see stopPolling/schedulePrune
			// in the service: pruning is only scheduled from the branch that frees the unit).
			jest.advanceTimersByTime(10 * 60_000);

			expect(service.getStatus(id)).toEqual(expect.objectContaining({ id, state: 'timeout' }));

			// Still reserved — a retry for the same unit is still rejected the same way as before
			// this window elapsed.
			await expect(service.run(baseSpec)).rejects.toThrow(/still running/);
		});
	});
});
