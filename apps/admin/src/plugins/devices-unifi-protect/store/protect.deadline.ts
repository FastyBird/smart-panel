export interface IProtectDeadline {
	signal: AbortSignal;
	/** True once the deadline, not a caller or the network, aborted the request. */
	expired: () => boolean;
	clear: () => void;
}

/**
 * Aborts a request after the given time so a stalled backend cannot keep a store busy forever.
 * An expired deadline says nothing about the backend operation, which may still have finished.
 */
export const startProtectDeadline = (ms: number): IProtectDeadline => {
	const controller = new AbortController();
	let expired = false;

	const timer = setTimeout((): void => {
		expired = true;
		controller.abort();
	}, ms);

	return {
		signal: controller.signal,
		expired: (): boolean => expired,
		clear: (): void => clearTimeout(timer),
	};
};
