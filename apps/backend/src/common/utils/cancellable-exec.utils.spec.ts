import { execFile } from 'node:child_process';

import { cancellableExecFile } from './cancellable-exec.utils';

jest.mock('node:child_process', () => ({ execFile: jest.fn() }));

describe('cancellableExecFile', () => {
	afterEach(() => {
		jest.resetAllMocks();
		jest.useRealTimers();
	});

	it('kills a cancelled read and waits for the callback that confirms closure', async () => {
		const kill = jest.fn();
		let close!: (error: Error | null, stdout: string, stderr: string) => void;
		jest.mocked(execFile).mockImplementation(((
			_file: unknown,
			_args: unknown,
			_opts: unknown,
			callback: typeof close,
		) => {
			close = callback;
			return { kill };
		}) as unknown as typeof execFile);
		const abort = new AbortController();
		let settled = false;
		const pending = cancellableExecFile('read-cli', [], abort.signal);
		void pending.then(
			() => {
				settled = true;
			},
			() => {
				settled = true;
			},
		);
		abort.abort(new Error('cancelled'));
		expect(kill).toHaveBeenCalledWith('SIGKILL');
		await Promise.resolve();
		expect(settled).toBe(false);
		close(new Error('killed'), '', '');
		await expect(pending).rejects.toThrow('cancelled');
	});

	it('uses a hard kill deadline even if the ordinary execFile timeout callback has not arrived', async () => {
		jest.useFakeTimers();
		const kill = jest.fn();
		let close!: (error: Error | null, stdout: string, stderr: string) => void;
		jest.mocked(execFile).mockImplementation(((
			_file: unknown,
			_args: unknown,
			_opts: unknown,
			callback: typeof close,
		) => {
			close = callback;
			return { kill };
		}) as unknown as typeof execFile);
		const pending = cancellableExecFile('read-cli', [], undefined, 50);
		const failed = expect(pending).rejects.toThrow('killed');
		await jest.advanceTimersByTimeAsync(50);
		expect(kill).toHaveBeenCalledWith('SIGKILL');
		close(new Error('killed'), '', '');
		await failed;
	});
});
