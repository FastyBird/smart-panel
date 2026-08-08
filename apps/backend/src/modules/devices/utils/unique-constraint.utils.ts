// Bounded to the column list itself — names, dots and the commas between them — rather than run to
// the end of the line: the text below is the driver's message *and* the wrapper's repetition of it,
// so anything greedier swallows the second copy along with the first.
const UNIQUE_CONSTRAINT_COLUMNS = /UNIQUE constraint failed: ([\w.]+(?:\s*,\s*[\w.]+)*)/;

/**
 * The driver's message for a failed write, driver error included.
 *
 * Matched on the message because that is all the sqlite driver gives: TypeORM wraps it in a
 * `QueryFailedError` whose `driverError` carries the text.
 */
const driverMessage = (error: unknown): string => {
	if (!(error instanceof Error)) {
		return '';
	}

	return `${error.message} ${(error as { driverError?: { message?: string } }).driverError?.message ?? ''}`;
};

/**
 * Whether a driver error is the database refusing a duplicate *primary key*.
 *
 * Narrower than "some unique index rejected this row", deliberately. The three creates that accept a
 * client-supplied id convert this into a sentence naming that id, and every one of these tables
 * carries other unique indexes as well — a device's `(identifier, type)`, a channel's
 * `(identifier, device)`, a property's `(identifier, channel)`. Reporting one of those as a reused id
 * tells the caller to change a field that did not collide while saying nothing about the one that
 * did, so anything but the primary key is left to travel on as itself: the HTTP layer's
 * `QueryFailedExceptionFilter` already reports it, and it did so before this ever caught anything.
 *
 * Two phrasings, because SQLite uses both: `PRIMARY KEY must be unique` for a rowid alias, and
 * `UNIQUE constraint failed: <table>.<column>` for everything else, listing every column of the index
 * that rejected the row — which is what separates a primary key from a composite index over it.
 *
 * Shared by the device, channel and channel-property creates so the sentence a colliding create gets
 * does not depend on which of them was reached.
 */
export const isPrimaryKeyCollision = (error: unknown, primaryKeyColumn = 'id'): boolean => {
	const message = driverMessage(error);

	if (message.includes('PRIMARY KEY must be unique')) {
		return true;
	}

	const columns = UNIQUE_CONSTRAINT_COLUMNS.exec(message);

	if (!columns) {
		return false;
	}

	const failed = columns[1]
		.split(',')
		.map((column) => column.trim().split('.').pop())
		.filter((column): column is string => typeof column === 'string' && column.length > 0);

	return failed.length === 1 && failed[0] === primaryKeyColumn;
};
