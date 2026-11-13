const isEmpty = (value: unknown): boolean => value === null || typeof value === 'undefined' || value === '';

export interface IHouseLocationMessages {
	// The coordinate is not a number in its range
	range: string;
	// Only one of the two coordinates is set
	pair: string;
}

/**
 * Builds the form rule of one coordinate of the house location. A coordinate may be left empty only
 * together with the other one: a latitude alone is not a place.
 */
export const houseLocationValidator =
	(other: () => unknown, limit: number, messages: IHouseLocationMessages) =>
	(_rule: unknown, value: unknown, callback: (error?: Error) => void): void => {
		if (isEmpty(value)) {
			callback(isEmpty(other()) ? undefined : new Error(messages.pair));

			return;
		}

		const number = Number(value);

		if (!Number.isFinite(number) || number < -limit || number > limit) {
			callback(new Error(messages.range));

			return;
		}

		callback(isEmpty(other()) ? new Error(messages.pair) : undefined);
	};
