/*
eslint-disable @typescript-eslint/no-explicit-any
*/
import { ZodArray, ZodDefault, ZodMap, ZodNullable, ZodObject, ZodOptional, ZodPipe, ZodRecord, type ZodTypeAny, z } from 'zod';

// unwraps optional/nullable/pipe wrappers to the inner schema
const unwrap = (t: ZodTypeAny): ZodTypeAny => {
	if (t instanceof ZodPipe) {
		return unwrap((t as any).in);
	}

	if (t instanceof ZodOptional) {
		return unwrap((t as any)._zod.def.innerType);
	}

	if (t instanceof ZodNullable) {
		return unwrap((t as any)._zod.def.innerType);
	}

	return t;
};

/**
 * Extract default values from a Zod schema as a plain object.
 * - Only returns keys that have `.default(...)`
 * - Recurses into nested objects
 * - Ignores required/validation — no parsing is performed
 */
export const getSchemaDefaults = <T extends ZodTypeAny>(schema: T): Partial<z.infer<T>> => {
	const s = unwrap(schema);

	// object: iterate its shape
	if (s instanceof ZodObject) {
		const out: Record<string, unknown> = {};
		const shape: Record<string, ZodTypeAny> = (s as any).shape;

		for (const key of Object.keys(shape)) {
			const field = shape[key];
			if (!field) continue;
			const unwrapped = unwrap(field);

			if (unwrapped instanceof ZodDefault) {
				// In Zod v4, default value is stored directly in _zod.def.defaultValue
				const defaultVal = (unwrapped as any)._zod.def.defaultValue;
				out[key] = typeof defaultVal === 'function' ? defaultVal() : defaultVal;
			} else {
				// recurse to find nested defaults (e.g., nested objects)
				const nested = getSchemaDefaults(field);

				if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) {
					out[key] = nested;
				}
			}
		}
		return out as Partial<z.infer<T>>;
	}

	// array + record/map: no top-level object keys to collect;
	// we only return defaults when the field itself has a default.
	if (s instanceof ZodArray || s instanceof ZodRecord || s instanceof ZodMap) {
		// if the array/record/map node itself has a default, caller will hit the ZodDefault case
		return {};
	}

	// direct default node (rare unless you pass a defaulted primitive schema)
	if (s instanceof ZodDefault) {
		const defaultVal = (s as any)._zod.def.defaultValue;
		return ((typeof defaultVal === 'function' ? defaultVal() : defaultVal) ?? {}) as Partial<z.infer<T>>;
	}

	// primitives / unions / enums without defaults → nothing to collect
	return {};
};
