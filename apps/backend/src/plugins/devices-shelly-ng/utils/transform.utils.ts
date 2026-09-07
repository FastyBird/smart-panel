export type CoerceNumberOpts = {
	clamp?: { min: number; max: number };
	allowNull?: boolean;
	round?: boolean;
};

export const toEnergy = (v: unknown): number => {
	if (typeof v === 'number') {
		return v;
	}

	if (typeof v === 'object' && v !== null) {
		const rec = v as Record<string, unknown>;

		const t = rec.total;

		if (typeof t === 'number') {
			return t;
		}

		if (typeof t === 'string') {
			const n = Number(t);

			return Number.isFinite(n) ? n : 0;
		}
	}

	return 0;
};

export const rssiToQuality = (rssi: number): number => {
	if (rssi <= -100) {
		return 0;
	}

	if (rssi >= -50) {
		return 100;
	}

	return Math.round(2 * (rssi + 100));
};

export type EmitValueFn = (event: string, ...args: unknown[]) => unknown;

/**
 * Real Shelly object characteristics never nest more than one level deep (e.g.
 * `aenergy: { total, by_minute, minute_ts }`, `battery: { percent, V }`). This caps
 * recursion well above that so legitimate payloads are unaffected, while bounding how
 * deep a maliciously crafted frame can push the call stack. Both producers of this
 * function feed on attacker-reachable input (the library WebSocket and the
 * unauthenticated sleeping-device WS server), so unbounded recursion here is a
 * denial-of-service vector - a sufficiently nested object could exhaust the stack and
 * crash the process, since the caller does not wrap this in a try/catch.
 */
const MAX_FLATTEN_DEPTH = 8;

/**
 * Emits a `value` event for `attr`, then recurses into plain-object values emitting
 * `attr.leaf` for every own key. Arrays are treated as leaves, not recursed into.
 * Recursion stops (without throwing) once `MAX_FLATTEN_DEPTH` is reached; the value at
 * that depth is still emitted under its own key, just not flattened further.
 *
 * Shared by both producers of component value changes so they emit the identical key
 * shape for object characteristics such as Shelly's `aenergy: { total, by_minute,
 * minute_ts }` and `battery: { percent, V }`:
 * - the library WebSocket path (`ShellyDeviceDelegate.handleChange`)
 * - the sleeping-device WS server (`ShellyWsServerService`)
 *
 * A handler registered for the parent key (e.g. `aenergy`) still receives the raw
 * object; a handler registered for a leaf key (e.g. `aenergy.total`) receives the
 * unwrapped scalar.
 */
export const emitFlattenedValue = (
	emit: EmitValueFn,
	compKey: string,
	attr: string,
	value: unknown,
	depth: number = 0,
): void => {
	emit('value', compKey, attr, value);

	if (depth >= MAX_FLATTEN_DEPTH) {
		return;
	}

	if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
		for (const [leaf, leafValue] of Object.entries(value as Record<string, unknown>)) {
			emitFlattenedValue(emit, compKey, `${attr}.${leaf}`, leafValue, depth + 1);
		}
	}
};
