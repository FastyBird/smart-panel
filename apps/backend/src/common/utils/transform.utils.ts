import { ClassConstructor, ClassTransformOptions, plainToInstance } from 'class-transformer';

import { CoerceNumberOpts } from '../../plugins/devices-shelly-ng/utils/transform.utils';

const toSnakeCase = (str: string): string => {
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
