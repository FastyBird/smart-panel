import { runBulkOperation } from './bulk.utils';

describe('runBulkOperation', () => {
	it('reports every item that went through', async () => {
		const perform = jest.fn().mockResolvedValue(undefined);

		const result = await runBulkOperation(['a', 'b', 'c'], perform);

		expect(result.succeeded).toEqual(['a', 'b', 'c']);
		expect(result.failed).toEqual([]);
		expect(perform).toHaveBeenCalledTimes(3);
	});

	// The whole reason failures are collected: the per-item endpoints each failed
	// on their own, and collapsing them into one request must not turn a single
	// refusal into a lost selection.
	it('keeps going after an item fails', async () => {
		const perform = jest
			.fn()
			.mockImplementation((id: string) =>
				id === 'b' ? Promise.reject(new Error('Item is hidden')) : Promise.resolve(),
			);

		const result = await runBulkOperation(['a', 'b', 'c'], perform);

		expect(result.succeeded).toEqual(['a', 'c']);
		expect(result.failed).toEqual([{ id: 'b', reason: 'Item is hidden' }]);
		expect(perform).toHaveBeenCalledTimes(3);
	});

	// Refusals that carry an explanation are worth passing back, the same way the
	// single-item endpoints translate them instead of answering "try again later".
	it('reports the thrown message as the reason', async () => {
		const perform = jest.fn().mockRejectedValue(new Error('Placement is immutable'));

		const result = await runBulkOperation(['a'], perform);

		expect(result.failed).toEqual([{ id: 'a', reason: 'Placement is immutable' }]);
	});

	it('falls back to the supplied reason when the failure carries no message', async () => {
		const perform = jest.fn().mockRejectedValue(new Error(''));

		const result = await runBulkOperation(['a'], perform, 'Scene could not be removed');

		expect(result.failed).toEqual([{ id: 'a', reason: 'Scene could not be removed' }]);
	});

	it('falls back for a rejection that is not an Error at all', async () => {
		const perform = jest.fn().mockRejectedValue('just a string');

		const result = await runBulkOperation(['a'], perform, 'Scene could not be removed');

		expect(result.failed).toEqual([{ id: 'a', reason: 'Scene could not be removed' }]);
	});

	// A selection can carry the same item twice - two rows of one item in
	// different groupings, for instance. Acting once keeps the caller's counts
	// honest.
	it('acts once on an item listed twice', async () => {
		const perform = jest.fn().mockResolvedValue(undefined);

		const result = await runBulkOperation(['a', 'a', 'b'], perform);

		expect(result.succeeded).toEqual(['a', 'b']);
		expect(perform).toHaveBeenCalledTimes(2);
	});

	it('answers an empty selection with an empty result', async () => {
		const perform = jest.fn();

		const result = await runBulkOperation([], perform);

		expect(result).toEqual({ succeeded: [], failed: [] });
		expect(perform).not.toHaveBeenCalled();
	});

	// Sequential on purpose: these operations hit the same tables, and running a
	// selection concurrently would trade the request storm for a write storm.
	it('performs the operations one at a time', async () => {
		const order: string[] = [];

		const perform = jest.fn().mockImplementation(async (id: string) => {
			order.push(`start:${id}`);

			await Promise.resolve();

			order.push(`end:${id}`);
		});

		await runBulkOperation(['a', 'b'], perform);

		expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
	});
});
