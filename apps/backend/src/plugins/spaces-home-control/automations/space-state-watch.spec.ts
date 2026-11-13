import { watchSpaceState } from './space-state-watch';

const flush = async (): Promise<void> => {
	for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe('watchSpaceState', () => {
	let hint: (() => void) | null;
	let stopped: jest.Mock;
	let reads: (() => Promise<string | undefined>)[];
	let value: string | undefined;
	let changed: jest.Mock;
	let error: jest.Mock;

	const watch = () =>
		watchSpaceState<string>({
			read: () => (reads.length > 0 ? reads.shift()() : Promise.resolve(value)),
			listen: (listener) => {
				hint = listener;

				return stopped;
			},
			changed,
			error,
		});

	const deferred = () => {
		let resolve!: (value: string | undefined) => void;
		const promise = new Promise<string | undefined>((done) => {
			resolve = done;
		});

		return { promise, resolve };
	};

	beforeEach(() => {
		hint = null;
		stopped = jest.fn();
		reads = [];
		value = 'occupied';
		changed = jest.fn();
		error = jest.fn();
	});

	it('takes the first known state as the baseline, not as a transition', async () => {
		watch();
		await flush();

		expect(changed).not.toHaveBeenCalled();

		value = 'vacant';
		hint();
		await flush();

		expect(changed.mock.calls).toEqual([['occupied', 'vacant']]);
	});

	it('reports nothing for a hint that did not change the state', async () => {
		watch();
		await flush();
		hint();
		hint();
		await flush();

		expect(changed).not.toHaveBeenCalled();
	});

	it('neither sets the baseline nor changes it on a state that is not known', async () => {
		value = undefined;
		watch();
		await flush();

		value = 'vacant';
		hint();
		await flush();

		expect(changed).not.toHaveBeenCalled();

		value = undefined;
		hint();
		await flush();
		value = 'vacant';
		hint();
		await flush();

		expect(changed).not.toHaveBeenCalled();

		value = undefined;
		hint();
		await flush();
		value = 'occupied';
		hint();
		await flush();

		expect(changed.mock.calls).toEqual([['vacant', 'occupied']]);
	});

	it('takes a read that fails as a state that is not known, and reports the failure', async () => {
		watch();
		await flush();

		reads.push(() => Promise.reject(new Error('Space not found')));
		hint();
		await flush();

		expect(changed).not.toHaveBeenCalled();
		expect(error).toHaveBeenCalledWith(new Error('Space not found'));

		value = 'vacant';
		hint();
		await flush();

		expect(changed.mock.calls).toEqual([['occupied', 'vacant']]);
	});

	it('does not overlap reads and reads once more after hints that came during a read', async () => {
		const slow = deferred();
		const read = jest.fn(() => Promise.resolve(value));

		reads.push(() => slow.promise);
		watchSpaceState<string>({
			read: () => (reads.length > 0 ? reads.shift()() : read()),
			listen: (listener) => {
				hint = listener;

				return stopped;
			},
			changed,
		});

		hint();
		hint();
		value = 'vacant';
		slow.resolve('occupied');
		await flush();

		expect(read).toHaveBeenCalledTimes(1);
		expect(changed.mock.calls).toEqual([['occupied', 'vacant']]);
	});

	it('reports nothing once it is released, also from a read that was running', async () => {
		const slow = deferred();

		const release = watch();

		await flush();

		reads.push(() => slow.promise);
		hint();
		release();
		slow.resolve('vacant');
		await flush();

		expect(stopped).toHaveBeenCalledTimes(1);
		expect(changed).not.toHaveBeenCalled();

		release();

		expect(stopped).toHaveBeenCalledTimes(1);
	});

	it('keeps watching when the listener of a change throws', async () => {
		changed.mockImplementationOnce(() => {
			throw new Error('broken');
		});

		watch();
		await flush();
		value = 'vacant';
		hint();
		await flush();
		value = 'occupied';
		hint();
		await flush();

		expect(error).toHaveBeenCalledWith(new Error('broken'));
		expect(changed.mock.calls).toEqual([
			['occupied', 'vacant'],
			['vacant', 'occupied'],
		]);
	});
});
