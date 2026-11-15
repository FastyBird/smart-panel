/** Reads the original plain value: implicit conversion would otherwise turn a number or boolean into a string. */
export const original =
	(wireName: string) =>
	({ obj }: { obj: Record<string, unknown> }): unknown =>
		obj[wireName];
