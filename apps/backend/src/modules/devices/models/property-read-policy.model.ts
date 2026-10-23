/** Veto-only data observation. It carries no value, producer, command or write authority. */
export class PropertyReadPolicyObservation {}

interface PolicyField {
	owner: object;
	key: string;
	chain: readonly object[];
	descriptor: Readonly<PropertyDescriptor>;
}
const observations = new WeakMap<PropertyReadPolicyObservation, readonly PolicyField[]>();

function readPolicyField(owner: object, key: string): PolicyField {
	const chain: object[] = [];
	const prototypes: Readonly<{ getPrototypeOf: (value: object) => object | null }> = Object;
	for (let cursor: object | null = owner; cursor; cursor = prototypes.getPrototypeOf(cursor)) {
		chain.push(cursor);
		const descriptor = Object.getOwnPropertyDescriptor(cursor, key);
		if (!descriptor) continue;
		if (!('value' in descriptor)) throw new Error('Read policy observation requires data fields');
		return { owner, key, chain: Object.freeze(chain), descriptor: Object.freeze(descriptor) };
	}
	throw new Error('Read policy observation field unavailable');
}

/**
 * Trusted providers declare the exact shallow invalidation data behind their policy.
 * Capture resolves descriptors once; final checks compare data/identity without calling
 * providers, getters or supplied verifiers. Related objects are never recursively certified.
 */
export function observePropertyReadPolicy(
	owner: object,
	keys: readonly string[],
	dependencies: readonly PropertyReadPolicyObservation[] = [],
): PropertyReadPolicyObservation {
	if (!keys.length) throw new Error('Read policy observation fields required');
	const fields = dependencies.flatMap((dependency) => {
		const original = observations.get(dependency);
		if (!original) throw new Error('Unqualified read policy observation');
		return original;
	});
	fields.push(...keys.map((key) => readPolicyField(owner, key)));
	const token = Object.freeze(new PropertyReadPolicyObservation());
	observations.set(token, Object.freeze(fields));
	return token;
}

export function isPropertyReadPolicyObservationCurrent(token: PropertyReadPolicyObservation): boolean {
	const fields = observations.get(token);
	if (!fields) return false;
	try {
		return fields.every((field) => {
			const current = readPolicyField(field.owner, field.key);
			return (
				current.chain.length === field.chain.length &&
				current.chain.every((owner, index) => owner === field.chain[index]) &&
				Object.is(current.descriptor.value, field.descriptor.value) &&
				current.descriptor.enumerable === field.descriptor.enumerable &&
				current.descriptor.configurable === field.descriptor.configurable &&
				current.descriptor.writable === field.descriptor.writable
			);
		});
	} catch {
		return false;
	}
}
