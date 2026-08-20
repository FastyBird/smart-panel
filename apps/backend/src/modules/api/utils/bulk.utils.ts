import { ExtensionLoggerService } from '../../../common/logger';
import { BulkFailureModel, BulkResultModel } from '../models/bulk.model';

/**
 * A constructor for an `Error` subclass, used to name which thrown types are
 * safe to forward to the client.
 */
type SafeErrorClass = new (...args: unknown[]) => Error;

export interface RunBulkOperationOptions {
	/** Reason reported for a failure whose message is not safe to forward. */
	fallbackReason: string;
	/**
	 * Error constructors whose message is safe to return to the client - the
	 * module's own exception types, the deliberate refusals a single-item
	 * endpoint would also translate into a response. Anything thrown that is
	 * not an instance of one of these is treated as unexpected and reported as
	 * `fallbackReason` instead, so a TypeORM error, a subscriber, or a plugin
	 * hook never forwards internal detail into the response. Defaults to none,
	 * so an operation that forgets to declare any leaks nothing.
	 */
	safeErrors?: SafeErrorClass[];
	/**
	 * Records an unexpected failure server-side. Sanitizing that failure out of
	 * the response would otherwise be the only trace it happened at all.
	 */
	logger: ExtensionLoggerService;
}

/**
 * Runs one operation across a selection and reports the outcome per item.
 *
 * Bulk endpoints exist because the per-item alternative was a request each,
 * which the shared request limit rejects once a selection grows. Collapsing the
 * round trips is the point, so the work is still performed one item at a time -
 * each operation keeps exactly the semantics, and the refusals, of its
 * single-item endpoint. What changes is the transport.
 *
 * Failures are collected rather than thrown: a selection is a set of
 * independent intents, and one item refusing must not discard the others.
 *
 * @param ids Identifiers to act on. Duplicates are acted on once, so the counts
 *   the caller reports stay honest when a selection lists the same item twice.
 * @param perform Runs the operation for one identifier. Throwing marks that
 *   item failed. The thrown message becomes the reported reason only when the
 *   error is an instance of one of `options.safeErrors` - the refusals that
 *   carry an explanation worth keeping. Anything else is logged server-side
 *   through `options.logger` and reported as `options.fallbackReason` instead,
 *   so an unexpected failure never forwards its raw message to the client.
 * @param options.fallbackReason Reason reported for a failure whose message is
 *   not safe to forward.
 * @param options.safeErrors Error constructors whose message is safe to
 *   forward to the client.
 * @param options.logger Records an unexpected failure server-side.
 */
export const runBulkOperation = async (
	ids: string[],
	perform: (id: string) => Promise<void>,
	options: RunBulkOperationOptions,
): Promise<BulkResultModel> => {
	const { fallbackReason, safeErrors = [], logger } = options;

	const result = new BulkResultModel();

	result.succeeded = [];
	result.failed = [];

	for (const id of [...new Set(ids)]) {
		try {
			await perform(id);

			result.succeeded.push(id);
		} catch (error) {
			const failure = new BulkFailureModel();

			failure.id = id;

			const isSafe = safeErrors.some((SafeError) => error instanceof SafeError);

			if (isSafe && error instanceof Error && error.message.length > 0) {
				failure.reason = error.message;
			} else {
				logger.error(`Bulk operation failed for id=${id}`, error instanceof Error ? error : String(error));

				failure.reason = fallbackReason;
			}

			result.failed.push(failure);
		}
	}

	return result;
};
