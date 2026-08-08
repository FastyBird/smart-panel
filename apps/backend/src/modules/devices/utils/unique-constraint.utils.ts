/**
 * Whether a driver error is the database refusing a duplicate key.
 *
 * Matched on the message because that is all the sqlite driver gives: TypeORM wraps it in a
 * `QueryFailedError` whose `driverError` carries the text, and the two phrasings below are the ones
 * SQLite uses for a primary-key collision across the versions this app runs on. The HTTP layer's
 * `QueryFailedExceptionFilter` matches the same string for the same reason; this needs the answer
 * *before* the exception leaves the service, to report it as the domain refusal it is.
 *
 * Shared by the three creates that accept a client-supplied id — device, channel and channel
 * property — so the sentence a colliding create gets does not depend on which of them was reached.
 */
export const isUniqueConstraintViolation = (error: unknown): boolean => {
	if (!(error instanceof Error)) {
		return false;
	}

	const driverMessage = (error as { driverError?: { message?: string } }).driverError?.message ?? '';
	const message = `${error.message} ${driverMessage}`;

	return message.includes('UNIQUE constraint failed') || message.includes('PRIMARY KEY must be unique');
};
