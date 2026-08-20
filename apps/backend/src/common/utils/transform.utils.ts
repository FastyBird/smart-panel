import { ClassConstructor, ClassTransformOptions, plainToInstance } from 'class-transformer';

import { CoerceNumberOpts } from '../../plugins/devices-shelly-ng/utils/transform.utils';

export const toSnakeCase = (str: string): string => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

export const toSnakeCaseKeys = <T, R>(obj: T): R => {
	if (Array.isArray(obj)) {
		return obj.map(toSnakeCaseKeys) as R;
	} else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
		return Object.fromEntries(
			Object.entries(obj).map(([key, value]) => [toSnakeCase(key), toSnakeCaseKeys(value)]),
		) as R;
	}

	return obj as unknown as R;
};

export function toInstance<T, V>(cls: ClassConstructor<T>, plain: V[], options?: ClassTransformOptions): T[];
export function toInstance<T, V>(cls: ClassConstructor<T>, plain: V, options?: ClassTransformOptions): T;
export function toInstance<T, V>(cls: ClassConstructor<T>, plain: V[] | V, options?: ClassTransformOptions): T[] | T {
	return plainToInstance(cls, toSnakeCaseKeys(plain), {
		enableImplicitConversion: true,
		excludeExtraneousValues: true,
		exposeUnsetFields: false,
		...options,
	});
}

/**
 * Reads a submitted field that may arrive under either its wire name or its camelCase
 * spelling, keeping an explicit `null` distinct from an absent field.
 *
 * `obj.wire_name ?? obj.camelName` cannot express that difference: a submitted `null` is
 * nullish, so it falls through to the other spelling and comes back `undefined` - which
 * every consumer downstream reads as "not submitted". For a secret that is the difference
 * between removing a stored credential and silently keeping it, and the removal is the case
 * that fails silently.
 */
export const readSubmittedValue = <T>(obj: unknown, wireName: string, camelName: string): T | null | undefined => {
	if (obj === null || typeof obj !== 'object') {
		return undefined;
	}

	const source = obj as Record<string, unknown>;

	if (wireName in source) {
		return source[wireName] as T | null;
	}

	if (camelName in source) {
		return source[camelName] as T | null;
	}

	return undefined;
};

export const clampNumber = (number: number, min: number, max: number): number => {
	return Math.max(min, Math.min(max, Number(number)));
};

export const coerceNumberSafe = (input: unknown, opts: CoerceNumberOpts = {}): number | null => {
	if (input === null) {
		return opts.allowNull ? null : 0;
	}

	if (typeof input === 'number') {
		if (!Number.isFinite(input)) {
			return 0;
		}

		let n = input;

		if (opts.round) {
			n = Math.round(n);
		}

		if (opts.clamp) {
			n = Math.max(opts.clamp.min, Math.min(opts.clamp.max, n));
		}

		return n;
	}

	if (typeof input === 'string' && input.trim()) {
		const n = Number(input);

		if (!Number.isFinite(n)) {
			return 0;
		}

		let v = n;

		if (opts.round) {
			v = Math.round(v);
		}

		if (opts.clamp) {
			v = Math.max(opts.clamp.min, Math.min(opts.clamp.max, v));
		}

		return v;
	}

	if (typeof input === 'boolean') {
		return input ? 1 : 0;
	}

	return 0;
};

export const coerceBooleanSafe = (input: unknown): boolean => {
	if (typeof input === 'boolean') {
		return input;
	}

	if (typeof input === 'number') {
		return Number.isFinite(input) && input !== 0;
	}

	if (typeof input === 'string') {
		const s = input.trim().toLowerCase();

		return s === '1' || s === 'true' || s === 'on' || s === 'yes';
	}

	return false;
};

export const safeToString = (val: unknown): string => {
	if (val === null || val === undefined) {
		return String(val as string | number | boolean);
	}

	if (typeof val === 'object') {
		try {
			return JSON.stringify(val);
		} catch {
			return '[unserializable object]';
		}
	}

	return String(val as string | number | boolean);
};

export const safeNumber = (val: unknown): number => {
	if (typeof val === 'number' && Number.isFinite(val)) {
		return val;
	}

	if (typeof val === 'string' && val.trim() !== '' && Number.isFinite(Number(val))) {
		return Number(val);
	}

	return Number(val as string | number | boolean);
};
