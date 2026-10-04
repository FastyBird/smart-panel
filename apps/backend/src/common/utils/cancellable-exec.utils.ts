import { execFile } from 'node:child_process';

/** Cancel unprivileged read processes immediately, and settle only after execFile has reaped the child. */
export function cancellableExecFile(
	file: string,
	args: readonly string[],
	signal?: AbortSignal,
	timeoutMs = 6_000,
	maxBuffer?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		let completed = false;
		let timer: NodeJS.Timeout | undefined;
		const onAbort = () => child.kill('SIGKILL');
		const child = execFile(
			file,
			[...args],
			{ timeout: timeoutMs, killSignal: 'SIGKILL', maxBuffer },
			(error, stdout, stderr) => {
				completed = true;
				clearTimeout(timer);
				signal?.removeEventListener('abort', onAbort);
				if (signal?.aborted) {
					reject(signal.reason instanceof Error ? signal.reason : new Error('The read was cancelled.'));
				} else if (error && typeof (error as NodeJS.ErrnoException).code !== 'number') {
					reject(error instanceof Error ? error : new Error('The read process failed.'));
				} else {
					resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: error ? Number(error.code) : 0 });
				}
			},
		);
		if (!completed) {
			signal?.addEventListener('abort', onAbort, { once: true });
			// Covers an abort between the initial check and listener registration.
			if (signal?.aborted) {
				onAbort();
			}
			timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
		}
	});
}
