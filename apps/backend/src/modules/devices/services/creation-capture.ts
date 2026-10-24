type OriginalFunction<Owner, Method> = Method extends (...args: infer Args) => infer Result
	? ((...args: Args) => Result) & Readonly<{ call: (receiver: Owner, ...args: Args) => Result }>
	: Method;
type OriginalFields<Owner> = { readonly [Key in keyof Owner]: OriginalFunction<Owner, Owner[Key]> };

/** Private, finite descriptor evidence. Looking at a replacement must never execute its getter. */
export interface CreationCapture<T extends object> {
	readonly receiver: T;
	readonly values: OriginalFields<T>;
	readonly current: () => boolean;
}

function descriptor(receiver: object, key: PropertyKey): { owner: object; value: PropertyDescriptor } | undefined {
	for (let owner: object | null = receiver; owner; owner = Object.getPrototypeOf(owner) as object | null) {
		const value = Object.getOwnPropertyDescriptor(owner, key);
		if (value) return { owner, value };
	}
	return undefined;
}

export function captureCreation<T extends object>(receiver: T, keys: readonly (keyof T)[]): CreationCapture<T> {
	const fields = keys.map((key) => ({ key, field: descriptor(receiver, key) }));
	const values = Object.create(null) as OriginalFields<T>;
	for (const { key, field } of fields) {
		if (field && !('value' in field.value)) throw new Error(`Creation accessor is unsupported: ${String(key)}`);
		Object.defineProperty(values, key, { value: field?.value.value, enumerable: true });
	}
	return Object.freeze({
		receiver,
		values: Object.freeze(values),
		current: () => {
			try {
				return fields.every(({ key, field }) => {
					const now = descriptor(receiver, key);
					return field === undefined
						? now === undefined
						: now?.owner === field.owner &&
								'value' in now.value &&
								now.value.value === field.value.value &&
								now.value.enumerable === field.value.enumerable &&
								now.value.configurable === field.value.configurable &&
								now.value.writable === field.value.writable;
				});
			} catch {
				return false;
			}
		},
	});
}

/** Traverse caller data once, retaining enumerable invalid fields for the existing DTO validators. */
export function snapshotCreation<T>(input: T, seen = new Map<object, unknown>()): T {
	if (input === null || typeof input !== 'object') return input;
	if (seen.has(input)) return seen.get(input) as T;
	if (input instanceof Date) return new Date(input.getTime()) as T;
	const output: object = Array.isArray(input)
		? new Array(input.length)
		: (Object.create(Object.getPrototypeOf(input) as object | null) as object);
	seen.set(input, output);
	for (const key of Object.keys(input))
		Object.defineProperty(output, key, {
			value: snapshotCreation(Reflect.get(input, key) as unknown, seen),
			enumerable: true,
			writable: true,
			configurable: true,
		});
	return output as T;
}

export function assertCreationCurrent(captures: readonly { current: () => boolean }[]): void {
	if (!captures.every((capture) => capture.current()))
		throw new Error('Original creation registration or method expired');
}

/** Retain optional absence and the hook's exact original receiver, without freezing plugin registrations. */
export function creationMapping<T extends object>(capture: CreationCapture<T>): T {
	const mapping = { ...capture.values } as T;
	for (const key of ['beforeCreate', 'afterCreate', 'withStructuralWrite']) {
		const hook: unknown = Reflect.get(capture.values, key);
		if (hook !== undefined && typeof hook !== 'function') throw new Error(`Invalid original creation hook: ${key}`);
		if (typeof hook === 'function') Reflect.set(mapping, key, hook.bind(capture.receiver));
	}
	return mapping;
}

export function invokeCreation<Args extends unknown[], Result>(
	method: (...args: Args) => Result,
	receiver: object,
	...args: Args
): Result {
	return Reflect.apply(method, receiver, args);
}
