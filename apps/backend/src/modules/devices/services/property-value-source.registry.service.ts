import { Injectable } from '@nestjs/common';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelPropertyEntity } from '../entities/devices.entity';

/**
 * Answers "where does this property's value live?".
 *
 * A property normally stores its value under its own id. A plugin may declare that some of its
 * properties read and write another property's series instead — for example a device assembled
 * from properties of other devices. Core stays unaware of any particular plugin: it only asks.
 */
export interface IPropertyValueSource {
	/** Entity discriminator this source applies to, matching `ChannelPropertyEntity.type`. */
	getType(): string;

	/** Storage key for the property, or null to use the property's own id. */
	resolve(property: ChannelPropertyEntity): string | null;

	/** Optional lifecycle gate for aliases or derived outputs, without changing their canonical storage key. */
	unavailableReason?(property: ChannelPropertyEntity): string | null;

	/** Whether a resolved value needs current producer authority rather than stored history. */
	requiresLiveValue?(property: ChannelPropertyEntity): boolean | null;
}

/**
 * Process-local routing observation, scoped to the registry that created it.
 * It carries no producer, publication, storage-write or command authority.
 */
export class PropertyReadSourceCapture {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
interface SourceFunctionView {
	readonly getType: () => string;
	readonly resolve: (property: ChannelPropertyEntity) => string | null;
	readonly unavailableReason?: (property: ChannelPropertyEntity) => string | null;
	readonly requiresLiveValue?: (property: ChannelPropertyEntity) => boolean | null;
}
interface SourceMethods {
	readonly getType: Readonly<{ call: (receiver: IPropertyValueSource) => string }>;
	readonly resolve: Readonly<{
		call: (receiver: IPropertyValueSource, property: ChannelPropertyEntity) => string | null;
	}>;
	readonly unavailableReason?: Readonly<{
		call: (receiver: IPropertyValueSource, property: ChannelPropertyEntity) => string | null;
	}>;
	readonly requiresLiveValue?: Readonly<{
		call: (receiver: IPropertyValueSource, property: ChannelPropertyEntity) => boolean | null;
	}>;
}
interface SourceRegistration {
	readonly source: IPropertyValueSource;
	readonly methods?: SourceMethods;
}
interface SourceReadRecord {
	readonly type: string;
	readonly registration: SourceRegistration | undefined;
	readonly property: ChannelPropertyEntity;
	readonly input: ChannelPropertyEntity;
	readonly descriptors: ReadonlyMap<PropertyKey, PropertyDescriptor>;
	readonly prototype: object | null;
	readonly prototypeChain: readonly object[];
	readonly prototypeFields: readonly Readonly<{ owner: object; key: string; descriptor: PropertyDescriptor }>[];
	readonly key: string;
	readonly unavailable: string | null;
	readonly live: boolean;
}
function ownReadArray(value: unknown, seen = new Set<object>()): unknown {
	const arrays: Readonly<{ isArray: (candidate: unknown) => candidate is unknown[] }> = Array;
	if (!arrays.isArray(value)) return value;
	if (seen.has(value)) throw new Error('Cyclic read source array');
	seen.add(value);
	const result: unknown[] = new Array<unknown>(value.length);
	for (const key of Reflect.ownKeys(value)) {
		if (key === 'length') continue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || descriptor.get || descriptor.set) throw new Error('Read source array requires data fields');
		Object.defineProperty(result, key, { ...descriptor, value: ownReadArray(descriptor.value, seen) });
	}
	seen.delete(value);
	return Object.freeze(result);
}
function sameReadArray(current: unknown, owned: unknown): boolean {
	const arrays: Readonly<{ isArray: (candidate: unknown) => candidate is unknown[] }> = Array;
	if (!arrays.isArray(current) || !arrays.isArray(owned)) return current === owned;
	const keys = Reflect.ownKeys(current);
	if (keys.length !== Reflect.ownKeys(owned).length || current.length !== owned.length) return false;
	return keys.every((key) => {
		const now = Object.getOwnPropertyDescriptor(current, key);
		const before = Object.getOwnPropertyDescriptor(owned, key);
		return (
			now !== undefined &&
			before !== undefined &&
			now.get === undefined &&
			now.set === undefined &&
			sameReadArray(now.value, before.value)
		);
	});
}
function readSourceMethodCurrent(source: object, key: string, original: unknown): boolean {
	for (let owner: object | null = source; owner; ) {
		const descriptor = Object.getOwnPropertyDescriptor(owner, key);
		if (descriptor)
			return descriptor.get === undefined && descriptor.set === undefined && descriptor.value === original;
		const reader: Readonly<{ getPrototypeOf: (value: object) => object | null }> = Object;
		owner = reader.getPrototypeOf(owner);
	}
	return original === undefined;
}
function sourceMethods(source: IPropertyValueSource): SourceMethods | undefined {
	for (const key of ['getType', 'resolve', 'unavailableReason', 'requiresLiveValue']) {
		let owner: object | null = source;
		while (owner) {
			const descriptor = Object.getOwnPropertyDescriptor(owner, key);
			if (descriptor) {
				if (descriptor.get || descriptor.set) return undefined;
				break;
			}
			const reader: Readonly<{ getPrototypeOf: (value: object) => object | null }> = Object;
			owner = reader.getPrototypeOf(owner);
		}
	}
	const view: SourceFunctionView = source;
	const methods = {
		getType: view.getType,
		resolve: view.resolve,
		unavailableReason: view.unavailableReason,
		requiresLiveValue: view.requiresLiveValue,
	};
	return Object.entries(methods).every(([key, value]) => readSourceMethodCurrent(source, key, value))
		? Object.freeze(methods)
		: undefined;
}
function evaluateReadSource(
	registrations: ReadonlyMap<string, SourceRegistration>,
	type: string,
	registration: SourceRegistration | undefined,
	input: ChannelPropertyEntity,
): Readonly<{ key: string; unavailable: string | null; live: boolean }> {
	if (registrations.get(type) !== registration) throw new Error('Original source membership lost');
	let key: unknown = input.id;
	let unavailable: string | null = null;
	let live: unknown = input.requiresLiveValue === true;
	if (registration) {
		const { source, methods } = registration;
		if (!methods || !Object.entries(methods).every(([name, method]) => readSourceMethodCurrent(source, name, method)))
			throw new Error('Original source method lost');
		if (methods.getType.call(source) !== type) throw new Error('Original source type lost');
		key = methods.resolve.call(source, input) ?? input.id;
		unavailable = methods.unavailableReason?.call(source, input) ?? null;
		live = methods.requiresLiveValue?.call(source, input) ?? input.requiresLiveValue === true;
		if (!Object.entries(methods).every(([name, method]) => readSourceMethodCurrent(source, name, method)))
			throw new Error('Original source changed during read');
	}
	if (
		typeof key !== 'string' ||
		key.length === 0 ||
		(unavailable !== null && typeof unavailable !== 'string') ||
		typeof live !== 'boolean'
	)
		throw new Error('Malformed source read contract');
	return { key, unavailable, live };
}
@Injectable()
export class PropertyValueSourceRegistryService {
	private readonly logger = createExtensionLogger(DEVICES_MODULE_NAME, 'PropertyValueSourceRegistryService');

	private readonly sources: Record<string, IPropertyValueSource> = {};
	private readonly readRegistrations = new Map<string, SourceRegistration>();
	private readonly readCaptures = new WeakMap<PropertyReadSourceCapture, SourceReadRecord>();

	register(source: IPropertyValueSource): boolean {
		const view: SourceFunctionView = source;
		const getType: Readonly<{ call: (receiver: IPropertyValueSource) => string }> = view.getType;
		const type = getType.call(source);

		if (type in this.sources) {
			this.logger.warn(`Value source already registered type=${type}`);

			return false;
		}

		this.sources[type] = source;
		let methods: SourceMethods | undefined;
		try {
			methods = sourceMethods(source);
			if (methods?.getType !== getType) methods = undefined;
		} catch {
			/* Ordinary opaque sources remain ordinary, never read-qualified. */
		}
		this.readRegistrations.set(type, Object.freeze({ source, methods }));

		this.logger.log(`Registered new value source type=${type}`);

		return true;
	}

	/**
	 * Observe the original provider and routing policy without qualifying a value.
	 * Own field identities and array contents are captured. Object-valued relations remain
	 * identity observations; this does not certify their nested graph or producer freshness.
	 */
	captureReadSource(property: ChannelPropertyEntity): PropertyReadSourceCapture {
		const type = property.type;
		const registration = this.readRegistrations.get(type);
		if (registration?.source !== this.sources[type]) throw new Error('Original source membership unavailable');
		if (registration && !registration.methods) throw new Error('Original value source methods unavailable');
		const prototypeReader: Readonly<{ getPrototypeOf: (value: object) => object | null }> = Object;
		const prototype = prototypeReader.getPrototypeOf(property);
		const prototypeChain: object[] = [];
		for (let owner = prototype; owner; owner = prototypeReader.getPrototypeOf(owner)) prototypeChain.push(owner);
		const descriptors = new Map<PropertyKey, PropertyDescriptor>();
		const input = new ChannelPropertyEntity();
		Object.setPrototypeOf(input, prototype);
		for (const key of Reflect.ownKeys(property)) {
			const descriptor = Object.getOwnPropertyDescriptor(property, key);
			if (!descriptor || descriptor.get || descriptor.set) throw new Error('Value source input must have data fields');
			descriptors.set(key, descriptor);
			Object.defineProperty(input, key, { ...descriptor, value: ownReadArray(descriptor.value) });
		}
		const prototypeFields: Array<Readonly<{ owner: object; key: string; descriptor: PropertyDescriptor }>> = [];
		for (const key of ['type', 'requiresLiveValue', 'isProjecting']) {
			for (let owner: object | null = property; owner; owner = prototypeReader.getPrototypeOf(owner)) {
				const descriptor = Object.getOwnPropertyDescriptor(owner, key);
				if (descriptor) {
					prototypeFields.push({ owner, key, descriptor });
					break;
				}
			}
		}
		Object.freeze(input);
		const result = evaluateReadSource(this.readRegistrations, type, registration, input);
		const token = Object.freeze(new PropertyReadSourceCapture());
		this.readCaptures.set(token, {
			type,
			registration,
			property,
			input,
			descriptors,
			prototype,
			prototypeChain,
			prototypeFields,
			...result,
		});
		if (!this.isReadSourceCurrent(token)) throw new Error('Original value source changed during capture');
		return token;
	}
	/** Shallow readonly routing input with owned arrays; callers must not mutate related objects. */
	readSourceInput(token: PropertyReadSourceCapture): Readonly<ChannelPropertyEntity> {
		const record = this.readCaptures.get(token);
		if (!record) throw new Error('Original value source capture unavailable');
		return record.input;
	}
	readSourceKey(token: PropertyReadSourceCapture): string {
		const record = this.readCaptures.get(token);
		if (!record) throw new Error('Original value source capture unavailable');
		return record.key;
	}
	/** Original captured policy DATA, not a currentness check or fresh provider dispatch. */
	readSourceUnavailableReason(token: PropertyReadSourceCapture): string | null {
		const record = this.readCaptures.get(token);
		if (!record) throw new Error('Original value source capture unavailable');
		return record.unavailable;
	}
	/** Internal veto only: no provider method or property getter is invoked. */
	isReadSourceStructurallyCurrent(token: PropertyReadSourceCapture): boolean {
		const record = this.readCaptures.get(token);
		if (
			!record ||
			this.readRegistrations.get(record.type) !== record.registration ||
			this.sources[record.type] !== record.registration?.source
		)
			return false;
		try {
			const prototypeReader: Readonly<{ getPrototypeOf: (value: object) => object | null }> = Object;
			if (
				prototypeReader.getPrototypeOf(record.property) !== record.prototype ||
				Reflect.ownKeys(record.property).length !== record.descriptors.size
			)
				return false;
			for (const [index, owner] of record.prototypeChain.entries()) {
				if (prototypeReader.getPrototypeOf(owner) !== (record.prototypeChain[index + 1] ?? null)) return false;
			}
			if (
				record.registration &&
				(!record.registration.methods ||
					!Object.entries(record.registration.methods).every(([name, method]) =>
						readSourceMethodCurrent(record.registration.source, name, method),
					))
			)
				return false;
			for (const [key, original] of record.descriptors) {
				const current = Object.getOwnPropertyDescriptor(record.property, key);
				const owned = Object.getOwnPropertyDescriptor(record.input, key);
				if (
					!current ||
					!owned ||
					current.get !== original.get ||
					current.set !== original.set ||
					current.value !== original.value ||
					!sameReadArray(current.value, owned.value)
				)
					return false;
			}
			for (const field of record.prototypeFields) {
				const current = Object.getOwnPropertyDescriptor(field.owner, field.key);
				if (
					!current ||
					current.get !== field.descriptor.get ||
					current.set !== field.descriptor.set ||
					current.value !== field.descriptor.value
				)
					return false;
			}
			return true;
		} catch {
			return false;
		}
	}
	isReadSourceCurrent(token: PropertyReadSourceCapture): boolean {
		const record = this.readCaptures.get(token);
		if (
			!record ||
			!readSourceMethodCurrent(this, 'isReadSourceStructurallyCurrent', originalReadSourceStructure) ||
			!originalReadSourceStructure.call(this, token)
		)
			return false;
		try {
			if (record.property.type !== record.type) return false;
			const result = evaluateReadSource(this.readRegistrations, record.type, record.registration, record.input);
			return (
				result.key === record.key &&
				result.unavailable === record.unavailable &&
				result.live === record.live &&
				readSourceMethodCurrent(this, 'isReadSourceStructurallyCurrent', originalReadSourceStructure) &&
				originalReadSourceStructure.call(this, token)
			);
		} catch {
			return false;
		}
	}
	closeReadSource(token: PropertyReadSourceCapture): void {
		this.readCaptures.delete(token);
	}

	/**
	 * Storage key for the property. Falls back to the property's own id when no plugin claims it,
	 * so an unregistered or orphaned property simply owns its series.
	 */
	resolve(property: ChannelPropertyEntity): string {
		return this.sources[property.type]?.resolve(property) ?? property.id;
	}

	/** A source can suspend qualified and reported authority while retaining its canonical physical series. */
	unavailableReason(property: ChannelPropertyEntity): string | null {
		return this.sources[property.type]?.unavailableReason?.(property) ?? null;
	}

	/** Entity policy remains available even when its runtime source provider is absent. */
	requiresLiveValue(property: ChannelPropertyEntity): boolean {
		return this.sources[property.type]?.requiresLiveValue?.(property) ?? property.requiresLiveValue === true;
	}

	/** True when the property's value is stored under a different property's key. */
	isProjected(property: ChannelPropertyEntity): boolean {
		return this.resolve(property) !== property.id;
	}

	list(): string[] {
		return Object.keys(this.sources);
	}
}

const readSourcePrototype: Readonly<{
	isReadSourceStructurallyCurrent: (token: PropertyReadSourceCapture) => boolean;
}> = PropertyValueSourceRegistryService.prototype;
// Exact original self-check function; no substituted public verifier is dispatched during policy evaluation.
const originalReadSourceStructure: Readonly<{
	call: (receiver: PropertyValueSourceRegistryService, token: PropertyReadSourceCapture) => boolean;
}> = readSourcePrototype.isReadSourceStructurallyCurrent;
