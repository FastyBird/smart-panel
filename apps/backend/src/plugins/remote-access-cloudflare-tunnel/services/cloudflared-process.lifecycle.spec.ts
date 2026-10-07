import { type ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { CLOUDFLARED_STOP_KILL_TIMEOUT_MS } from '../remote-access-cloudflare-tunnel.constants';

import { CloudflaredProcessService } from './cloudflared-process.service';

jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
jest.mock('../../../common/logger', () => ({
	createExtensionLogger: () => ({ log: jest.fn(), warn: mockWarn }),
}));

const mockWarn = jest.fn();

class FakeChild extends EventEmitter {
	pid: number | undefined = 123;
	stderr = new EventEmitter();
	kill = jest.fn((_signal: NodeJS.Signals) => true);
}

describe('CloudflaredProcessService event ownership', () => {
	const token = 'secret-first-token';
	const options = { token, protocol: 'auto', metricsAddress: '127.0.0.1:20246' };
	let service: CloudflaredProcessService;
	let child: FakeChild;

	function start(next = new FakeChild(), nextToken = token): FakeChild {
		jest.mocked(spawn).mockReturnValueOnce(next as unknown as ChildProcess);
		service.start({ ...options, token: nextToken });
		return next;
	}

	function close(target: FakeChild, code = 0): void {
		target.emit('exit', code, null);
		target.emit('close', code, null);
	}

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		service = new CloudflaredProcessService();
		child = start();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('isolates late stderr, errors, close and old stop completion from a replacement', async () => {
		child.stderr.emit('data', Buffer.from(`partial ${token.slice(0, 8)}`));
		const stopping = service.stop(100);
		child.emit('exit', 0, null);
		const replacement = start(new FakeChild(), 'replacement-token');
		const startedAt = service.getStartedAt();
		child.stderr.emit('data', Buffer.from(`${token.slice(8)}\n`));
		child.emit('error', new Error(`old error ${token}`));
		child.emit('close', 1, null);
		await stopping;

		expect(service.isRunning()).toBe(true);
		expect(service.getStartedAt()).toBe(startedAt);
		expect(service.getLastExit()).toBeNull();
		expect(service.getStderrLines()).toEqual([]);
		expect(mockWarn).not.toHaveBeenCalled();
		expect(replacement.kill).not.toHaveBeenCalled();
		expect(jest.getTimerCount()).toBe(0);
		expect(child.eventNames()).toEqual([]);
		expect(child.stderr.listenerCount('data')).toBe(0);
		close(replacement);
	});

	it('ignores a failed spawn’s later exit after a replacement has started', () => {
		child.pid = undefined;
		child.emit('error', new Error('spawn failed'));
		const replacement = start();
		child.emit('exit', -1, null);
		child.emit('close', -1, null);
		expect(service.isRunning()).toBe(true);
		expect(service.getLastExit()).toBeNull();
		close(replacement);
	});

	it('redacts split chunks and error diagnostics using the originating token', () => {
		child.stderr.emit('data', Buffer.from(`token ${token.slice(0, 8)}`));
		child.stderr.emit('data', Buffer.from(`${token.slice(8)}\n`));
		child.emit('error', new Error(`error ${token}`));
		expect(service.isRunning()).toBe(true);
		expect(service.getStderrLines()).toEqual(['token ***redacted***', 'error ***redacted***']);
		expect(mockWarn).toHaveBeenCalledWith('cloudflared process error: error ***redacted***');
		close(child);
	});

	it('coalesces concurrent stop requests and cleans wait listeners and timers', async () => {
		const first = service.stop(100);
		const second = service.stop(20);
		expect(child.kill).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(100);
		expect(child.kill.mock.calls).toEqual([['SIGTERM'], ['SIGKILL']]);
		child.emit('exit', null, 'SIGKILL');
		await Promise.all([first, second]);
		expect(jest.getTimerCount()).toBe(0);
		expect(child.listenerCount('exit')).toBe(0);
		expect(child.listenerCount('close')).toBe(1);
		expect(child.listenerCount('error')).toBe(1);
		child.emit('close', null, 'SIGKILL');
		expect(child.eventNames()).toEqual([]);
	});

	it('keeps waiting when a runtime error arrives during stop', async () => {
		const stopping = service.stop(100);
		child.emit('error', new Error(`signal error ${token}`));
		expect(service.isRunning()).toBe(true);
		expect(jest.getTimerCount()).toBe(1);
		jest.advanceTimersByTime(100);
		expect(child.kill).toHaveBeenLastCalledWith('SIGKILL');
		close(child);
		await stopping;
		expect(jest.getTimerCount()).toBe(0);
		expect(child.eventNames()).toEqual([]);
	});

	it('cleans timers when kill synchronously reports exit', async () => {
		child.kill.mockImplementation(() => {
			close(child);
			return true;
		});
		await service.stop(100);
		expect(service.isRunning()).toBe(false);
		expect(jest.getTimerCount()).toBe(0);
		expect(child.eventNames()).toEqual([]);
	});

	it.each(['error', 'close'] as const)('settles stop on %s without an exit event', async (event) => {
		const stopping = service.stop(100);
		if (event === 'error') {
			child.pid = undefined;
			child.emit('error', new Error(`spawn failed ${token}`));
		} else {
			child.emit('close', -1, null);
		}
		await stopping;
		expect(service.isRunning()).toBe(false);
		expect(jest.getTimerCount()).toBe(0);
		if (event === 'error') {
			expect(mockWarn).toHaveBeenCalledWith('cloudflared process error: spawn failed ***redacted***');
			child.emit('close', -1, null);
		}
		expect(child.eventNames()).toEqual([]);
	});

	it.each(['false', 'throw', 'no-exit'] as const)(
		'fails within a bound and retains ownership when kill returns %s',
		async (mode) => {
			if (mode === 'false') {
				child.kill.mockReturnValue(false);
			} else if (mode === 'throw') {
				child.kill.mockImplementation(() => {
					throw new Error(`signal failed ${token}`);
				});
			}
			const startedAt = service.getStartedAt();
			const stopping = service.stop(100);
			const rejection = expect(stopping).rejects.toThrow('termination could not be confirmed');
			jest.advanceTimersByTime(100 + CLOUDFLARED_STOP_KILL_TIMEOUT_MS);
			await rejection;
			expect(service.isRunning()).toBe(true);
			expect(service.getStartedAt()).toBe(startedAt);
			expect(service.getLastExit()).toBeNull();
			service.start({ ...options, token: 'new-token' });
			expect(spawn).toHaveBeenCalledTimes(1);
			expect(jest.getTimerCount()).toBe(0);
			expect(child.listenerCount('exit')).toBe(1);
			expect(child.listenerCount('close')).toBe(1);
			expect(child.listenerCount('error')).toBe(1);
			const retry = service.stop(100);
			close(child);
			await retry;
			expect(service.isRunning()).toBe(false);
			expect(jest.getTimerCount()).toBe(0);
			expect(child.eventNames()).toEqual([]);
			const replacement = start();
			expect(spawn).toHaveBeenCalledTimes(2);
			expect(service.getLastExit()).toBeNull();
			close(replacement);
		},
	);

	it('flushes the final unterminated stderr line on close with redaction', () => {
		child.stderr.emit('data', Buffer.from(`final ${token}`));
		close(child);
		expect(service.getLastStderrLine()).toBe('final ***redacted***');
	});
});
