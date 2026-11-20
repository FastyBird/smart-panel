let lastIngress = 0;

/**
 * Process-local arrival order of reported samples. A sample takes its number when it enters the devices
 * module, before any asynchronous processing, so a reader can tell whether a report arrived after a given
 * moment even when both share a millisecond, or the report is still being processed.
 */
export function nextSampleIngress(): number {
	return ++lastIngress;
}

/** The number of the latest sample that arrived; every later sample has a higher one. */
export function currentSampleIngress(): number {
	return lastIngress;
}
