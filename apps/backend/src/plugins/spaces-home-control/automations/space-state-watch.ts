/** What a watch reads: the state, or undefined while it is not known */
export type SpaceStateRead<T> = () => Promise<T | undefined>;

export interface SpaceStateWatchOptions<T> {
	/** Reads the state now; undefined, or a read that fails, means it is not known */
	read: SpaceStateRead<T>;
	/** Starts listening for the hint that the state may have changed and returns the function that stops it */
	listen: (hint: () => void) => () => void;
	/** Called with the last known state and the new one, whenever a known state is followed by another */
	changed: (from: T, to: T) => void;
	/** Tells two states apart; strict equality when left out */
	same?: (a: T, b: T) => boolean;
	/** Told about a read or a `changed` that threw; never thrown back */
	error?: (error: unknown) => void;
}

/**
 * Follows one state of a space and reports its transitions (design § Trigger semantics).
 *
 * The state is read when the watch starts and again on every hint. The first state that is known is the
 * baseline, not a transition, so arming a trigger, or starting the backend, starts nothing. A state that is
 * not known - a failed read, occupancy that can not be qualified - neither sets the baseline nor counts as a
 * change: the next known state is compared with the last known one, so known, unknown and the same known
 * again is no transition.
 *
 * Reads never overlap and their results are taken in order: a hint that comes while a read is running asks
 * for one more read after it, which reads the state as it is then. Several hints during one read cost one
 * read. Nothing is reported once the watch is released, also not by a read that was running.
 */
export const watchSpaceState = <T>(options: SpaceStateWatchOptions<T>): (() => void) => {
	const same = options.same ?? ((a: T, b: T) => a === b);

	let known: { value: T } | null = null;
	let released = false;
	let reading = false;
	let again = false;

	const readOnce = async (): Promise<T | undefined> => {
		try {
			return await options.read();
		} catch (error) {
			options.error?.(error);

			return undefined;
		}
	};

	const take = (value: T): void => {
		if (known === null) {
			known = { value };

			return;
		}

		if (same(known.value, value)) return;

		const from = known.value;

		known = { value };

		try {
			options.changed(from, value);
		} catch (error) {
			options.error?.(error);
		}
	};

	const refresh = (): void => {
		if (released) return;

		if (reading) {
			again = true;

			return;
		}

		reading = true;

		void (async () => {
			try {
				do {
					again = false;

					const value = await readOnce();

					if (released) return;

					if (value !== undefined) take(value);
				} while (again && !released);
			} finally {
				reading = false;
			}
		})();
	};

	const stop = options.listen(refresh);

	refresh();

	return () => {
		if (released) return;

		released = true;
		stop();
	};
};
