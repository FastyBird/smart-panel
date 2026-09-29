import { StorageWriteBuffer } from './storage-write-buffer';

const deferred = () => {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => (resolve = done));
	return { promise, resolve };
};

describe('StorageWriteBuffer', () => {
	it('admits live updates during I/O, batches history in order and applies capacity backpressure', async () => {
		const first = deferred();
		const write = jest
			.fn<Promise<void>, [number[]]>()
			.mockImplementationOnce(() => first.promise)
			.mockResolvedValue();
		const buffer = new StorageWriteBuffer(write, jest.fn(), 3);
		await buffer.enqueue(() => 1);
		await buffer.enqueue(() => 2);
		await buffer.enqueue(() => 3);
		let admitted = false;
		const fourth = buffer.enqueue(() => 4).then(() => (admitted = true));
		await Promise.resolve();
		expect(admitted).toBe(false);
		expect(write.mock.calls).toEqual([[[1]]]);
		first.resolve();
		await fourth;
		await buffer.flush();
		expect(write.mock.calls).toEqual([[[1]], [[2, 3]], [[4]]]);
	});

	it('flush is an admission barrier, not a wait for future producers', async () => {
		const first = deferred();
		const second = deferred();
		const write = jest
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockImplementationOnce(() => second.promise);
		const buffer = new StorageWriteBuffer(write, jest.fn());
		await buffer.enqueue(() => 1);
		const flushed = buffer.flush();
		await buffer.enqueue(() => 2);
		first.resolve();
		await flushed;
		expect(write).toHaveBeenCalledTimes(2);
		second.resolve();
		await buffer.close();
	});

	it('reports rejected batches and continues without unhandled rejection or a stuck barrier', async () => {
		const error = new Error('storage unavailable');
		const write = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
		const report = jest.fn();
		const buffer = new StorageWriteBuffer(write, report);
		await buffer.enqueue(() => 1);
		await buffer.flush();
		await buffer.enqueue(() => 2);
		await buffer.flush();
		expect(report).toHaveBeenCalledWith(error);
		expect(write).toHaveBeenCalledTimes(2);
	});

	it('shutdown drains admitted history and refuses new or capacity-waiting admissions', async () => {
		const active = deferred();
		const buffer = new StorageWriteBuffer(() => active.promise, jest.fn(), 1);
		await buffer.enqueue(() => 1);
		const waiting = buffer.enqueue(() => 2);
		const rejected = expect(waiting).rejects.toThrow('closed');
		let closed = false;
		const shutdown = buffer.close().then(() => (closed = true));
		await expect(buffer.enqueue(() => 3)).rejects.toThrow('closed');
		expect(closed).toBe(false);
		active.resolve();
		await Promise.all([shutdown, rejected]);
	});
});
