import { type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

import { TAILSCALE_CHILD_KILL_GRACE_MS, TAILSCALE_CHILD_TERM_GRACE_MS } from '../remote-access-tailscale.constants';
import {
	TailscaleChildTerminationException,
	TailscaleOperationCancelledException,
	TailscaleOperationInProgressException,
} from '../remote-access-tailscale.exceptions';

import { TailscaleOperationCoordinatorService } from './tailscale-operation-coordinator.service';

class Child extends EventEmitter {
	kill = jest.fn<boolean, [NodeJS.Signals]>();
	asProcess(): ChildProcess {
		return this as unknown as ChildProcess;
	}
}

function deferred<T>() {
	let resolve: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe('TailscaleOperationCoordinatorService', () => {
	let coordinator: TailscaleOperationCoordinatorService;
	beforeEach(() => {
		jest.useFakeTimers();
		coordinator = new TailscaleOperationCoordinatorService();
	});
	afterEach(() => {
		jest.useRealTimers();
	});

	it('revokes an in-flight owner immediately without waiting for its stalled await', async () => {
		const delayed = deferred<void>();
		const writes = jest.fn();
		const generation = coordinator.getGeneration();
		const original = coordinator.run('connect', async (token) => {
			await delayed.promise;
			coordinator.assertCurrent(token);
			writes();
		});
		const rejection = expect(original).rejects.toBeInstanceOf(TailscaleOperationCancelledException);
		await coordinator.interrupt('disconnect', () => Promise.resolve());
		await rejection;
		expect(coordinator.isCurrent(generation)).toBe(false);
		delayed.resolve();
		await Promise.resolve();
		expect(writes).not.toHaveBeenCalled();
	});

	it('rejects competing mutations while an owner is active, while permitting nested owned commands', async () => {
		const delayed = deferred<void>();
		const original = coordinator.run('login', async () => {
			await coordinator.run('preferences', () => Promise.resolve());
			await delayed.promise;
		});
		expect(coordinator.getOperation()).toBe('login');
		await expect(coordinator.run('connect', () => Promise.resolve())).rejects.toBeInstanceOf(
			TailscaleOperationInProgressException,
		);
		delayed.resolve();
		await original;
		expect(coordinator.getOperation()).toBeNull();
	});

	it('does not let a retired async context own a future mutation', async () => {
		const delayed = deferred<void>();
		let late: Promise<void>;
		await coordinator.run('connect', () => {
			late = delayed.promise.then(() => coordinator.run('serve', () => Promise.resolve()));
			return Promise.resolve();
		});
		const rejected = expect(late).rejects.toBeInstanceOf(TailscaleOperationCancelledException);
		delayed.resolve();
		await rejected;
	});

	it('waits for close after SIGTERM rather than treating a kill request as a reaped child', async () => {
		const child = new Child();
		void coordinator.trackChild(child.asProcess());
		let stopped = false;
		const stop = coordinator.interrupt('disconnect', () => {
			stopped = true;
			return Promise.resolve();
		});
		expect(child.kill).toHaveBeenCalledWith('SIGTERM');
		await Promise.resolve();
		expect(stopped).toBe(false);
		child.emit('exit', 0);
		await Promise.resolve();
		expect(stopped).toBe(false);
		child.emit('close', 0);
		await stop;
		expect(stopped).toBe(true);
		expect(coordinator.hasPendingChildren()).toBe(false);
	});

	it('escalates an ignored SIGTERM to SIGKILL and resumes only after close', async () => {
		const child = new Child();
		child.kill.mockImplementation((signal) => {
			if (signal === 'SIGKILL') {
				child.emit('close', null);
			}
			return true;
		});
		void coordinator.trackChild(child.asProcess());
		const stop = coordinator.interrupt('disconnect', () => Promise.resolve());
		await jest.advanceTimersByTimeAsync(TAILSCALE_CHILD_TERM_GRACE_MS);
		await stop;
		expect(child.kill.mock.calls.map(([signal]) => signal)).toEqual(['SIGTERM', 'SIGKILL']);
	});

	it('fails within the finite deadline when SIGKILL never closes the child and blocks another login', async () => {
		const child = new Child();
		void coordinator.trackChild(child.asProcess());
		const stop = coordinator.interrupt('disconnect', () => Promise.resolve());
		const rejected = expect(stop).rejects.toBeInstanceOf(TailscaleChildTerminationException);
		await jest.advanceTimersByTimeAsync(TAILSCALE_CHILD_TERM_GRACE_MS + TAILSCALE_CHILD_KILL_GRACE_MS);
		await rejected;
		expect(coordinator.hasPendingChildren()).toBe(true);
		await expect(coordinator.run('login', () => Promise.resolve())).rejects.toBeInstanceOf(
			TailscaleOperationInProgressException,
		);
		child.emit('close', null);
		await expect(coordinator.run('login', () => Promise.resolve())).resolves.toBeUndefined();
	});

	it('coalesces concurrent termination requests for the same child', async () => {
		const child = new Child();
		void coordinator.trackChild(child.asProcess());
		const first = coordinator.terminateChild(child.asProcess());
		const second = coordinator.terminateChild(child.asProcess());
		expect(first).toBe(second);
		expect(child.kill).toHaveBeenCalledTimes(1);
		child.emit('close', null);
		await first;
	});
});
