import { ClassConstructor, ClassTransformOptions, plainToInstance } from 'class-transformer';

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
