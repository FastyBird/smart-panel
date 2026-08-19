import { BulkFailureModel, BulkResultModel } from '../models/bulk.model';

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
 *   item failed; the thrown message becomes the reported reason, so refusals
 *   that carry an explanation keep it.
 */
export const runBulkOperation = async (
	ids: string[],
	perform: (id: string) => Promise<void>,
	fallbackReason = 'Item could not be processed',
): Promise<BulkResultModel> => {
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
			failure.reason = error instanceof Error && error.message.length > 0 ? error.message : fallbackReason;

			result.failed.push(failure);
		}
	}

	return result;
};
