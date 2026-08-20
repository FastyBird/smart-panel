import { ExtensionLoggerService, createExtensionLogger } from '../../../common/logger';

import { runBulkOperation } from './bulk.utils';

// Stands in for a module's own exception type - one of `safeErrors` - the
// deliberate, user-facing refusal a single-item endpoint would also translate
// into a response.
class ModuleRefusalError extends Error {}

// Stands in for a failure nobody declared safe: a TypeORM error, a
// subscriber, or a plugin hook, none of which were ever meant to reach a
// client verbatim.
class QueryFailedError extends Error {}

describe('runBulkOperation', () => {
	let logger: ExtensionLoggerService;

	beforeEach(() => {
		logger = createExtensionLogger('test-module', 'TestComponent');
	});

	it('reports every item that went through', async () => {
		const perform = jest.fn().mockResolvedValue(undefined);

		const result = await runBulkOperation(['a', 'b', 'c'], perform, {
			fallbackReason: 'Item could not be processed',
			logger,
		});

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
				id === 'b' ? Promise.reject(new ModuleRefusalError('Item is hidden')) : Promise.resolve(),
			);

		const result = await runBulkOperation(['a', 'b', 'c'], perform, {
			fallbackReason: 'Item could not be processed',
			safeErrors: [ModuleRefusalError],
			logger,
		});

		expect(result.succeeded).toEqual(['a', 'c']);
		expect(result.failed).toEqual([{ id: 'b', reason: 'Item is hidden' }]);
		expect(perform).toHaveBeenCalledTimes(3);
	});

	// Refusals that carry an explanation are worth passing back, the same way the
	// single-item endpoints translate them instead of answering "try again later" -
	// but only once the error is named as one the caller is willing to show.
	it('forwards the message of a declared safe error', async () => {
		const perform = jest.fn().mockRejectedValue(new ModuleRefusalError('Placement is immutable'));

		const result = await runBulkOperation(['a'], perform, {
			fallbackReason: 'Item could not be processed',
			safeErrors: [ModuleRefusalError],
			logger,
		});

		expect(result.failed).toEqual([{ id: 'a', reason: 'Placement is immutable' }]);
	});

	it('falls back to the supplied reason when a safe failure carries no message', async () => {
		const perform = jest.fn().mockRejectedValue(new ModuleRefusalError(''));

		const result = await runBulkOperation(['a'], perform, {
			fallbackReason: 'Scene could not be removed',
			safeErrors: [ModuleRefusalError],
			logger,
		});

		expect(result.failed).toEqual([{ id: 'a', reason: 'Scene could not be removed' }]);
	});

	it('falls back for a rejection that is not an Error at all', async () => {
		const perform = jest.fn().mockRejectedValue('just a string');

		const result = await runBulkOperation(['a'], perform, {
			fallbackReason: 'Scene could not be removed',
			safeErrors: [ModuleRefusalError],
			logger,
		});

		expect(result.failed).toEqual([{ id: 'a', reason: 'Scene could not be removed' }]);
	});

	// A selection can carry the same item twice - two rows of one item in
	// different groupings, for instance. Acting once keeps the caller's counts
	// honest.
	// Describing the thrown value for the log must not itself throw. A
	// null-prototype object has no conversion to a primitive at all, and
	// `Symbol.toPrimitive` is code the thrower controls - either would escape the
	// catch and abandon every item still to come, which is the one thing
	// collecting failures per item exists to prevent.
	it.each([
		['an object with no prototype', (): unknown => Object.create(null)],
		[
			'an object that throws on conversion',
			(): unknown => ({
				[Symbol.toPrimitive]: () => {
					throw new Error('boom');
				},
			}),
		],
	])('survives a rejection that cannot be converted to a string - %s', async (_label, makeValue) => {
		const perform = jest.fn().mockRejectedValueOnce(makeValue()).mockResolvedValueOnce(undefined);

		const result = await runBulkOperation(['a', 'b'], perform, {
			fallbackReason: 'Item could not be processed',
			logger,
		});

		// The later item still ran, which is what a throw here would have prevented.
		expect(result.succeeded).toEqual(['b']);
		expect(result.failed).toEqual([{ id: 'a', reason: 'Item could not be processed' }]);
		expect(perform).toHaveBeenCalledTimes(2);
	});

	it('acts once on an item listed twice', async () => {
		const perform = jest.fn().mockResolvedValue(undefined);

		const result = await runBulkOperation(['a', 'a', 'b'], perform, {
			fallbackReason: 'Item could not be processed',
			logger,
		});

		expect(result.succeeded).toEqual(['a', 'b']);
		expect(perform).toHaveBeenCalledTimes(2);
	});

	it('answers an empty selection with an empty result', async () => {
		const perform = jest.fn();

		const result = await runBulkOperation([], perform, { fallbackReason: 'Item could not be processed', logger });

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

		await runBulkOperation(['a', 'b'], perform, { fallbackReason: 'Item could not be processed', logger });

		expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
	});

	// The leak this option exists to close: an internal failure must never reach
	// a 200 response body verbatim, even though it is still an instance of
	// `Error` and even though older code forwarded any `Error` message.
	describe('an error that is not declared safe', () => {
		it('is reported as the fallback reason, not its own message', async () => {
			const perform = jest.fn().mockRejectedValue(new QueryFailedError('SELECT * FROM users WHERE id = ?'));

			const result = await runBulkOperation(['a'], perform, {
				fallbackReason: 'Item could not be processed',
				safeErrors: [ModuleRefusalError],
				logger,
			});

			expect(result.failed).toEqual([{ id: 'a', reason: 'Item could not be processed' }]);

			// Assert the raw text is genuinely gone from what a client would receive,
			// not merely that the reason happens to equal the fallback string.
			const serialized = JSON.stringify(result);

			expect(serialized).not.toContain('SELECT');
			expect(serialized).not.toContain('users');
		});

		it('is logged server-side, so the failure leaves a trace somewhere', async () => {
			const error = new QueryFailedError('SELECT * FROM users WHERE id = ?');
			const perform = jest.fn().mockRejectedValue(error);
			const errorSpy = jest.spyOn(logger, 'error');

			await runBulkOperation(['a'], perform, {
				fallbackReason: 'Item could not be processed',
				safeErrors: [ModuleRefusalError],
				logger,
			});

			expect(errorSpy).toHaveBeenCalledTimes(1);
			expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('id=a'), error);
		});
	});
});
