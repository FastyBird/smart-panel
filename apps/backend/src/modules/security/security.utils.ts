import { SecurityLastEvent } from './contracts/security-signal.type';

/**
 * Compare two lastEvent candidates and return the one with the newest valid timestamp.
 * Returns the candidate if current is undefined, or if the candidate has a newer timestamp.
 * Skips candidates with invalid (NaN) timestamps.
 */
export function pickNewestEvent(
	current: SecurityLastEvent | undefined,
	candidate: SecurityLastEvent,
): SecurityLastEvent | undefined {
	const candidateTime = new Date(candidate.timestamp).getTime();

	if (Number.isNaN(candidateTime)) {
		return current;
	}

	if (current == null) {
		return candidate;
	}

	const currentTime = new Date(current.timestamp).getTime();

	if (Number.isNaN(currentTime) || candidateTime > currentTime) {
		return candidate;
	}

	return current;
}
