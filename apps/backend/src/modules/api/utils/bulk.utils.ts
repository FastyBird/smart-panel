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
 * Reads a thrown `Error`'s own message, or `undefined` when there is nothing
 * readable there.
 */
const readMessage = (error: Error): string | undefined => {
	try {
		const { message } = error;

		return typeof message === 'string' && message.length > 0 ? message : undefined;
	} catch {
		return undefined;
	}
};

/**
 * Describes a thrown value for the log, without the description itself being
 * able to throw.
 *
 * Nothing about a thrown value is safe to touch unguarded. `String(value)` runs
 * code the thrower controls - a `Symbol.toPrimitive`, or on a null-prototype
 * object no conversion at all - and an `Error` is no better: `message` and
 * `stack` are plain properties on the exceptions raised here, but a getter that
 * throws is a getter that throws inside the catch block, escaping it and
 * abandoning every item still to come. Collecting failures per item exists
 * precisely so one bad item cannot do that, so every read below is guarded.
 */
const describeThrown = (value: unknown): string => {
	if (typeof value === 'string') {
		return value;
	}

	if (value instanceof Error) {
		try {
			const { stack } = value;

			if (typeof stack === 'string' && stack.length > 0) {
				return stack;
			}
		} catch {
			// Falls through to the message, which is guarded in turn.
		}

		return readMessage(value) ?? '<unreadable Error>';
	}

	if (value === undefined) {
		return 'undefined';
	}

	try {
		// Covers null, numbers and booleans too, and renders an object's fields
		// rather than the `[object Object]` a plain conversion would produce.
		return JSON.stringify(value) ?? `<unreadable ${typeof value}>`;
	} catch {
		return `<unreadable ${typeof value}>`;
	}
};

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
			const safeMessage = isSafe && error instanceof Error ? readMessage(error) : undefined;

			if (typeof safeMessage === 'string') {
				failure.reason = safeMessage;
			} else {
				// The description, never the value: the logger's own formatter reads
				// `stack` and `message` off an `Error` it is handed, which would put an
				// unguarded accessor right back into the path this catch has to survive.
				logger.error(`Bulk operation failed for id=${id}`, describeThrown(error));

				failure.reason = fallbackReason;
			}

			result.failed.push(failure);
		}
	}

	return result;
};
