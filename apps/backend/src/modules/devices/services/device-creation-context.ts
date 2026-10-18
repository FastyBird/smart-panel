import { ValidationError, ValidatorOptions, validate } from 'class-validator';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

import { EventEmitter2 } from '@nestjs/event-emitter';

import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import type { CreationStorageDestinations } from '../../storage/services/storage.service';
import type { ClimateAutomationParticipantTurn } from '../contracts/climate-automation.contract';
import { EventType, PermissionType } from '../devices.constants';
import { DEVICES_MODULE_NAME } from '../devices.constants';
import { ChannelEntity, ChannelPropertyEntity, DeviceEntity } from '../entities/devices.entity';

import type { ClimateAutomationWriterService } from './climate-automation-writer.service';
import type {
	CreationProducerObservation,
	PropertyProducerRegistryService,
} from './property-producer.registry.service';

const admitted = new WeakSet<DeviceCreationContext>();
const admission = Symbol('internal-device-creation');
const originalValidation = new AsyncLocalStorage<DeviceCreationContext>();
const ownedContexts = new WeakMap<DeviceCreationContext, OwnedCreationContextRecord>();
const logger = createExtensionLogger(DEVICES_MODULE_NAME, 'DeviceCreationContext');

/** Internal transaction capability. Public DTOs cannot select a manager or publication callback. */
export class DeviceCreationContext {
	private readonly publications: { publish: () => Promise<void> | void; requiresActivation: boolean }[] = [];
	private active = true;

	private constructor(
		readonly manager: EntityManager,
		private readonly allowedType: string,
		capability: symbol,
	) {
		if (capability !== admission || !manager.queryRunner?.isTransactionActive)
			throw new Error('Device creation requires an admitted transaction');
		admitted.add(this);
	}

	static fromReserved(
		writer: ClimateAutomationWriterService,
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		recipe: object,
	): DeviceCreationContext {
		const owned = writer.admitCreationContext(manager, turn, recipe);
		const context = new DeviceCreationContext(manager, 'virtual', admission);
		ownedContexts.set(context, owned);
		return context;
	}

	toJSON(): Readonly<Record<string, never>> {
		return {};
	}

	private refuseOwned(message: string): never {
		const error = new Error(message);
		const record = ownedContexts.get(this);
		if (record) return record.refuse(error);
		throw error;
	}

	get isOriginalOwned(): boolean {
		return ownedContexts.get(this) !== undefined;
	}
	/** Runs the SAME class-validator constraints; this scope routes only the closed parent identity read. */
	validate(instance: object, options: ValidatorOptions): Promise<ValidationError[]> {
		if (!ownedContexts.get(this)) return validate(instance, options);
		this.assertOriginalAdmission();
		return originalValidation.run(this, async () => {
			const errors = await validate(instance, options);
			this.assertOriginalAdmission();
			return errors;
		});
	}

	/** Undefined means ordinary routing; a present stale scope throws and NEVER falls back. */
	static readOriginalDeviceIdentity(
		deviceId: string,
	): Promise<Readonly<{ id: string; type: string }> | null> | undefined {
		const context = originalValidation.getStore();
		if (!context) return undefined;
		const owned = ownedContexts.get(context);
		context.assertOriginalAdmission();
		if (!owned || deviceId !== owned.deviceId) context.refuseOwned('Original creation parent required');
		return context.readOriginalDeviceIdentity(deviceId);
	}

	private async readOriginalDeviceIdentity(deviceId: string): Promise<Readonly<{ id: string; type: string }> | null> {
		this.assertOriginalAdmission();
		const owned = ownedContexts.get(this);
		if (!owned || deviceId !== owned.deviceId) this.refuseOwned('Original creation parent required');
		const identity = await this.manager
			.createQueryBuilder(DeviceEntity, 'device')
			.select('device.id', 'id')
			.addSelect('device.type', 'type')
			.where('device.id = :id', { id: deviceId })
			.callListeners(false)
			.getRawOne<{ id: string; type: string | number }>();
		this.assertOriginalAdmission();
		if (!identity) return null;
		if (identity.id !== owned.deviceId || identity.type !== owned.nativeDeviceDiscriminator)
			this.refuseOwned('Original native creation parent changed');
		// Public integration identity is exposed only after proving the original raw native row.
		return Object.freeze({ id: identity.id, type: this.allowedType });
	}

	/** Called BEFORE reading any create input. A transactionActive boolean is insufficient. */
	assertOriginalAdmission(): void {
		if (!admitted.has(this)) this.refuseOwned('Genuine original creation context required');
		ownedContexts.get(this)?.assertBusiness();
		if (!this.active) this.refuseOwned('Device creation context closed');
	}

	catalogCreatedAt(): string {
		this.assertOriginalAdmission();
		if (!ownedContexts.get(this)) this.refuseOwned('Original creation timestamp required');
		return ownedContexts.get(this).createdAt;
	}

	/** The real beforeCreate hook sees the required RO template; only the retained setting plan may materialize RW. */
	materializeProperty(property: ChannelPropertyEntity): void {
		this.assertOriginalAdmission();
		const expected = this.expectedCatalogProperty(property.id);
		if (property.permissions.length !== 1 || property.permissions[0] !== PermissionType.READ_ONLY)
			this.refuseOwned('Original readonly creation template required');
		if (expected.permissions === PermissionType.READ_WRITE) property.permissions = [PermissionType.READ_WRITE];
		else if (expected.permissions !== PermissionType.READ_ONLY)
			this.refuseOwned('Unsupported retained property permissions');
	}

	expectedCatalogProperty(
		id: string,
	): Readonly<Record<string, import('../contracts/climate-automation.contract').ClimateAutomationJson>> {
		this.assertOriginalAdmission();
		const row = ownedContexts.get(this)?.properties.get(id);
		if (!row) this.refuseOwned('Original creation property required');
		return row;
	}

	assertMapping(kind: OwnedCreationCatalogJob['kind'], mapping: object): void {
		this.assertOriginalAdmission();
		if (ownedContexts.get(this) && !ownedContexts.get(this).mappingCurrent(kind, mapping))
			this.refuseOwned('Original creation mapping required');
	}

	stampCatalog(row: DeviceEntity | ChannelEntity | ChannelPropertyEntity): void {
		const owned = ownedContexts.get(this);
		if (!owned) return;
		owned.assertBusiness();
		if (!owned.identities.has(row.id)) this.refuseOwned('Unexpected creation row');
		row.createdAt = new Date(owned.createdAt);
		Reflect.set(row, 'updatedAt', null);
	}

	deferCatalog(
		kind: 'device' | 'channel' | 'property',
		row: DeviceEntity | ChannelEntity | ChannelPropertyEntity,
		mapping: object,
		events: EventEmitter2,
		input?: object,
	): void {
		const owned = ownedContexts.get(this);
		if (!owned) this.refuseOwned('Original creation context required');
		owned.assertBusiness();
		const expectedKind = row.id === owned.deviceId ? 'device' : owned.properties.has(row.id) ? 'property' : 'channel';
		if (!owned.identities.has(row.id) || kind !== expectedKind || owned.jobs.some((job) => job.row.id === row.id))
			this.refuseOwned('Unexpected or duplicate creation publication');
		const hook: unknown = Reflect.get(mapping, 'afterCreate');
		if (!owned.mappingCurrent(kind, mapping) || (hook !== undefined && typeof hook !== 'function'))
			this.refuseOwned('Original creation mapping lost');
		const methods: Readonly<{
			emit: ReceiverFunction<EventEmitter2, Parameters<EventEmitter2['emit']>, ReturnType<EventEmitter2['emit']>>;
		}> = events;
		owned.jobs.push(Object.freeze({ kind, row, mapping, hook, input, events, emit: methods.emit }));
	}

	beginCatalogChild(kind: OwnedCreationCatalogJob['kind'], input: Readonly<{ id?: unknown }>): CreationCatalogChild {
		this.assertOriginalAdmission();
		const record = ownedContexts.get(this);
		if (!record) this.refuseOwned('Original creation context required');
		return record.beginCatalog(kind, input);
	}

	async drainOriginalBusiness(): Promise<void> {
		const record = ownedContexts.get(this);
		if (!record) this.refuseOwned('Original creation context required');
		await record.drainBusiness();
		this.active = false;
	}

	fixCatalogJobs(catalog: DeviceEntity): void {
		this.assertOriginalAdmission();
		if (!ownedContexts.get(this)) this.refuseOwned('Original creation context required');
		ownedContexts.get(this).fixCatalog(catalog);
		Object.freeze(ownedContexts.get(this).jobs);
	}

	closeOriginalBusiness(): void {
		ownedContexts.get(this)?.closeBusiness();
	}

	/** Commits the admitted catalog before activating it and isolating each subsequent publication failure. */
	static async run<T>(
		writer: (operation: (manager: EntityManager) => Promise<T>) => Promise<T>,
		allowedType: string,
		operation: (context: DeviceCreationContext) => Promise<T>,
		afterCommit: (result: T) => Promise<void> | void,
		outputPropertyId?: string,
	): Promise<T> {
		let context: DeviceCreationContext;
		const result = await writer(async (manager) => {
			context = new DeviceCreationContext(manager, allowedType, admission);
			try {
				return await operation(context);
			} finally {
				context.active = false;
			}
		});
		if (context.manager.queryRunner?.isTransactionActive)
			throw new Error('Device creation publications require the owning COMMIT');
		// Only a successful owning writer returns. Rollback never reaches the callbacks or lease installation.
		const failures: { stage: string; error: unknown }[] = [];
		let activated = false;
		try {
			await afterCommit(result);
			activated = true;
		} catch (error) {
			failures.push({ stage: 'activation', error });
		}
		for (const publication of context.publications) {
			// Property hooks may install a fallback lease with incomplete metadata when activation failed.
			if (publication.requiresActivation && !activated) continue;
			try {
				await publication.publish();
			} catch (error) {
				failures.push({ stage: 'publication', error });
			}
		}
		context.publications.length = 0;
		for (const failure of failures)
			logger.error(
				`Device creation committed for ${allowedType}${outputPropertyId ? ` output=${outputPropertyId}` : ''}, but post-commit ${failure.stage} failed`,
				failure.error instanceof Error
					? failure.error
					: new Error('Post-commit callback rejected', { cause: failure.error }),
			);
		return result;
	}

	/** Refuses use outside the admitted integration and active transaction. */
	assertType(type: string): void {
		ownedContexts.get(this)?.assertBusiness();
		if (
			!admitted.has(this) ||
			!this.active ||
			!this.manager.queryRunner?.isTransactionActive ||
			type !== this.allowedType
		)
			throw new Error('Device creation context is not active for this integration');
	}

	/** Queues a callback for COMMIT; activation-dependent property hooks are suppressed if activation fails. */
	defer(publication: () => Promise<void> | void, requiresActivation = false): void {
		this.assertType(this.allowedType);
		if (ownedContexts.get(this)) this.refuseOwned('Original creation requires a closed catalog job');
		this.publications.push({ publish: publication, requiresActivation });
	}
}

interface ReceiverFunction<R, A extends unknown[], V> {
	readonly call: (receiver: R, ...args: A) => V;
}
export interface CreationCatalogChild {
	readonly finish: (failure?: { cause: unknown }) => void;
	readonly track: <T>(promise: Promise<T>) => Promise<T>;
}
export interface OwnedCreationCatalogJob {
	readonly kind: 'device' | 'channel' | 'property';
	readonly row: DeviceEntity | ChannelEntity | ChannelPropertyEntity;
	readonly mapping: object;
	readonly hook: unknown;
	readonly input?: object;
	readonly events: EventEmitter2;
	readonly emit: ReceiverFunction<EventEmitter2, Parameters<EventEmitter2['emit']>, ReturnType<EventEmitter2['emit']>>;
}
/** Writer-owned internal record. Never returned by public routes or carried in event JSON. */
export interface OwnedCreationContextRecord {
	readonly deviceId: string;
	readonly nativeDeviceDiscriminator: string | number;
	readonly properties: ReadonlyMap<
		string,
		Readonly<Record<string, import('../contracts/climate-automation.contract').ClimateAutomationJson>>
	>;
	readonly identities: ReadonlySet<string>;
	readonly createdAt: string;
	readonly assertBusiness: () => void;
	readonly mappingCurrent: (kind: OwnedCreationCatalogJob['kind'], mapping: object) => boolean;
	readonly jobs: OwnedCreationCatalogJob[];
	readonly fixCatalog: (catalog: DeviceEntity) => void;
	readonly closeBusiness: () => void;
	readonly drainBusiness: () => Promise<void>;
	readonly beginCatalog: (
		kind: OwnedCreationCatalogJob['kind'],
		input: Readonly<{ id?: unknown }>,
	) => CreationCatalogChild;
	readonly refuse: (cause: unknown) => never;
}
/** No manager, context, transaction, lock, install or send methods. */
export class DeviceCreationPublicationLease {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
interface PublicationRecord {
	active: boolean;
	eligible: boolean;
	readonly identities: ReadonlySet<string>;
	readonly originalCurrent: () => boolean;
	readonly originalBusinessCurrent: () => boolean;
	readonly writer: ClimateAutomationWriterService;
	readonly lease: DeviceCreationPublicationLease;
	readonly source: DataSource;
	readonly destinations: CreationStorageDestinations;
	catalog?: DeviceEntity;
	readonly information: InformationRegistration;
	readonly children: Promise<void>[];
	readonly childKeys: Set<string>;
	admitted: number;
	settled: number;
	failed: number;
	attempted: number;
	completed: number;
	submitted: number;
	storageCompleted: number;
	failure?: { cause: unknown };
	closed: boolean;
}
interface InformationRegistration {
	active: boolean;
	readonly receiver: object;
	readonly method: object;
	readonly events: EventEmitter2;
	readonly chainCurrent: () => boolean;
}
interface RequiredInvocation {
	readonly lease: DeviceCreationPublicationLease;
	readonly registration: InformationRegistration;
	readonly pending: Promise<void>;
	readonly release: () => void;
	readonly reject: (cause: unknown) => void;
	readonly gate: Promise<void>;
	readonly openGate: () => void;
	entered: boolean;
	settled: boolean;
}
export class CreationInformationHandlerCapture {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
interface InformationCapture {
	readonly registration: InformationRegistration;
	readonly vector: readonly unknown[];
	readonly currentMetadata: () => boolean;
	readonly listenersMethod: EventEmitter2['listeners'];
}
const informationCaptures = new WeakMap<CreationInformationHandlerCapture, InformationCapture>();
const publicationRecords = new WeakMap<DeviceCreationPublicationLease, PublicationRecord>();
const publicationIds = new Map<string, Set<PublicationRecord>>();
const informationRegistrations = new WeakMap<EventEmitter2, InformationRegistration>();
const leafQueries = new WeakMap<
	QueryRunner,
	Readonly<{
		writer: ClimateAutomationWriterService;
		lease: DeviceCreationPublicationLease;
		query: string;
		parameters: readonly unknown[];
	}>
>();
export type ReadCacheDecision = 'publish' | 'overlap' | 'changed';
export class ReadCacheObservation {
	toJSON(): Readonly<Record<string, never>> {
		return {};
	}
}
export type StatusReadBinding = Readonly<{ deviceId?: unknown; propertyId?: unknown; empty: boolean }>;
interface ReadCacheRecord {
	readonly id: string;
	readonly status: boolean;
	readonly deletions: Set<string>;
	invalidDeletion: boolean;
	overlap: boolean;
	changed: boolean;
}
const readCacheRecords = new WeakMap<ReadCacheObservation, ReadCacheRecord>();
const readCacheIds = new Map<string, Set<ReadCacheObservation>>();
const statusReadObservations = new Set<ReadCacheObservation>();
function unlinkReadCache(observation: ReadCacheObservation): ReadCacheRecord | undefined {
	const record = readCacheRecords.get(observation);
	if (!record) return undefined;
	readCacheRecords.delete(observation);
	const set = readCacheIds.get(record.id);
	set?.delete(observation);
	if (set?.size === 0) readCacheIds.delete(record.id);
	statusReadObservations.delete(observation);
	return record;
}
function overlapReadCaches(ids: Iterable<string>): void {
	for (const id of ids)
		for (const token of readCacheIds.get(id) ?? []) {
			const record = readCacheRecords.get(token);
			if (record) record.overlap = true;
		}
}
const closedRequiredInvocation = Symbol('closed-original-information');
const requiredInvocations = new WeakMap<DeviceEntity, RequiredInvocation | typeof closedRequiredInvocation>();

export function creationMethodCurrent(receiver: object, key: string, original: unknown): boolean {
	for (let object: object | null = receiver; object; ) {
		const descriptor = Object.getOwnPropertyDescriptor(object, key);
		if (descriptor)
			return descriptor.get === undefined && descriptor.set === undefined && descriptor.value === original;
		const parent: unknown = Object.getPrototypeOf(object);
		object = typeof parent === 'object' && parent !== null ? parent : null;
	}
	return false;
}

/** Finite original-owned publication evidence. An ordinary caller cannot forge a current token. */
export class DeviceCreationPublicationEngine {
	/** A finite historical-read veto, never creation or command authority. */
	static observeReadCache(id: string, status = false): ReadCacheObservation {
		if (this !== DeviceCreationPublicationEngine) return Object.freeze(new ReadCacheObservation());
		const token = Object.freeze(new ReadCacheObservation());
		const record: ReadCacheRecord = {
			id,
			status,
			deletions: new Set<string>(),
			invalidDeletion: false,
			overlap: (publicationIds.get(id)?.size ?? 0) > 0,
			changed: typeof id !== 'string' || id.length === 0,
		};
		readCacheRecords.set(token, record);
		const entries = readCacheIds.get(id) ?? new Set<ReadCacheObservation>();
		entries.add(token);
		readCacheIds.set(id, entries);
		if (status) statusReadObservations.add(token);
		return token;
	}
	static dirtyReadCache(ids: readonly string[]): void {
		for (const id of ids)
			for (const token of readCacheIds.get(id) ?? []) {
				const record = readCacheRecords.get(token);
				if (record) record.changed = true;
			}
	}
	static noteStatusPropertyDeletion(id: string): void {
		for (const token of statusReadObservations) {
			const record = readCacheRecords.get(token);
			if (!record) continue;
			if (typeof id !== 'string' || id.length === 0) record.invalidDeletion = true;
			else record.deletions.add(id);
		}
	}
	static finishReadCache(token: ReadCacheObservation, binding?: StatusReadBinding): ReadCacheDecision {
		const record = unlinkReadCache(token);
		if (this !== DeviceCreationPublicationEngine) return 'changed';
		if (!record || !originalReadCacheApi.current()) return 'changed';
		if (record.invalidDeletion) record.changed = true;
		if (record.status && record.deletions.size > 0) {
			const property = binding?.propertyId;
			const device = binding?.deviceId;
			if (
				!binding ||
				binding.empty ||
				typeof property !== 'string' ||
				property.length === 0 ||
				(device !== undefined && (typeof device !== 'string' || device !== record.id)) ||
				record.deletions.has(property)
			)
				record.changed = true;
		}
		return record.changed ? 'changed' : record.overlap ? 'overlap' : 'publish';
	}
	static closeReadCache(token: ReadCacheObservation): void {
		unlinkReadCache(token);
	}
	static assert(lease: DeviceCreationPublicationLease, ...ids: readonly string[]): void {
		const record = publicationRecords.get(lease);
		if (
			!record ||
			!record.active ||
			!record.eligible ||
			record.closed ||
			record.failure ||
			!record.originalCurrent() ||
			ids.some((id) => !record.identities.has(id))
		) {
			const error = new Error('Original creation publication unavailable');
			if (record) {
				record.failure ??= { cause: error };
				record.active = false;
			}
			throw error;
		}
	}

	/** Verified against the actual writer-owned turn/recipe, never a caller boolean. */
	static fromReserved(
		writer: ClimateAutomationWriterService,
		manager: EntityManager,
		turn: ClimateAutomationParticipantTurn,
		recipe: object,
	): DeviceCreationPublicationLease {
		const evidence = writer.admitCreationPublication(manager, turn, recipe);
		const lease = Object.freeze(new DeviceCreationPublicationLease());
		const information = informationCaptures.get(evidence.information)?.registration;
		if (!information || !this.informationCurrent(evidence.information))
			throw new Error('Original information handler unavailable');
		const record: PublicationRecord = {
			active: true,
			eligible: false,
			closed: false,
			identities: evidence.identities,
			originalCurrent: evidence.current,
			originalBusinessCurrent: evidence.stagingCurrent,
			writer,
			lease,
			source: evidence.source,
			destinations: evidence.destinations,
			information,
			children: [],
			childKeys: new Set(),
			admitted: 0,
			settled: 0,
			failed: 0,
			attempted: 0,
			completed: 0,
			submitted: 0,
			storageCompleted: 0,
		};
		overlapReadCaches(record.identities);
		publicationRecords.set(lease, record);
		for (const id of record.identities) {
			const records = publicationIds.get(id) ?? new Set<PublicationRecord>();
			records.add(record);
			publicationIds.set(id, records);
		}

		writer.registerCreationPublication(lease, recipe);
		return lease;
	}

	/** Writer verifies original native ACK and THIS structural owner's release before opening. */
	static acknowledge(writer: ClimateAutomationWriterService, lease: DeviceCreationPublicationLease): void {
		const record = publicationRecords.get(lease);
		if (!record || record.closed || record.eligible || !writer.isCreationPublicationAcknowledged(lease))
			throw new Error('Original creation acknowledgement unavailable');
		record.eligible = true;
	}

	/** Exact payload objects retain their owned marker after terminal failure; never ordinary fallback. */
	static isOwnedPayload(payload: DeviceEntity): boolean {
		return requiredInvocations.has(payload);
	}

	static invalidateIds(ids: readonly string[]): void {
		originalReadCacheApi.dirty.call(originalReadCacheApi.receiver, ids);
		for (const id of ids) {
			for (const record of publicationIds.get(id) ?? []) record.active = false;
		}
	}

	static beginChild(
		lease: DeviceCreationPublicationLease,
		kind: 'status' | 'connectivity' | 'value' | 'state',
		id: string,
	): Readonly<{ finish: (failure?: { cause: unknown }) => void }> {
		this.assert(lease, id);
		const record = publicationRecords.get(lease);
		const key = `${kind}:${id}`;
		if (!record || record.closed || record.childKeys.has(key))
			throw new Error('Original creation child already admitted or closed');
		record.childKeys.add(key);
		record.admitted++;
		let settled = false;
		return Object.freeze({
			finish: (failure?: { cause: unknown }) => {
				if (settled) return;
				settled = true;
				record.settled++;
				if (failure) {
					record.failed++;
					record.failure ??= failure;
				}
			},
		});
	}

	static storageSubmitted(lease: DeviceCreationPublicationLease): void {
		this.assert(lease);
		const record = publicationRecords.get(lease);
		if (record) record.submitted++;
	}
	static storageCompleted(lease: DeviceCreationPublicationLease): void {
		const record = publicationRecords.get(lease);
		if (record) record.storageCompleted++;
	}
	static report(lease: DeviceCreationPublicationLease) {
		const record = publicationRecords.get(lease);
		if (!record)
			return Object.freeze({
				attempted: 0,
				completed: 0,
				admitted: 0,
				settled: 0,
				failed: 0,
				submitted: 0,
				storageCompleted: 0,
				terminal: 'closed',
			});
		return Object.freeze({
			attempted: record.attempted,
			completed: record.completed,
			admitted: record.admitted,
			settled: record.settled,
			failed: record.failed,
			submitted: record.submitted,
			storageCompleted: record.storageCompleted,
			terminal: record.failure ? 'incomplete' : 'settled',
		});
	}

	static assertProperty(lease: DeviceCreationPublicationLease, property: ChannelPropertyEntity): void {
		this.assert(lease);
		const catalog = this.catalog(lease);
		if (!catalog.channels.some((channel) => channel.properties.includes(property)))
			throw new Error('Exact original property snapshot required');
		this.assert(lease, property.id);
	}

	static refuse(lease: DeviceCreationPublicationLease, cause: unknown): never {
		const record = publicationRecords.get(lease);
		if (record) {
			record.failure ??= { cause };
			record.active = false;
		}
		throw cause;
	}

	static storage(lease: DeviceCreationPublicationLease): CreationStorageDestinations {
		this.assert(lease);
		const record = publicationRecords.get(lease);
		if (!record) throw new Error('Original storage destinations unavailable');
		return record.destinations;
	}

	static catalogProperty(lease: DeviceCreationPublicationLease, id: string): ChannelPropertyEntity {
		this.assert(lease, id);
		const record = publicationRecords.get(lease);
		const property = record?.catalog?.channels
			.flatMap((channel) => channel.properties)
			.find((property) => property.id === id);
		if (!property) throw new Error('Original catalog property unavailable');
		return property;
	}

	static catalog(lease: DeviceCreationPublicationLease): DeviceEntity {
		this.assert(lease);
		const catalog = publicationRecords.get(lease)?.catalog;
		if (!catalog) throw new Error('Original catalog unavailable');
		return catalog;
	}

	static retainCatalog(
		writer: ClimateAutomationWriterService,
		lease: DeviceCreationPublicationLease,
		recipe: object,
		catalog: DeviceEntity,
	): void {
		writer.assertCreationCatalog(lease, recipe, catalog);
		const record = publicationRecords.get(lease);
		if (!record || record.catalog || record.eligible) throw new Error('Original catalog already fixed');
		record.catalog = freezeCreationSnapshot(catalog);
	}

	static stagingCurrent(lease: DeviceCreationPublicationLease): boolean {
		const record = publicationRecords.get(lease);
		return !!record && record.active && !record.closed && !record.failure && record.originalBusinessCurrent();
	}

	static async probe(lease: DeviceCreationPublicationLease, id: string): Promise<void> {
		this.assert(lease, id);
		const record = publicationRecords.get(lease);
		if (!record) throw new Error('Original creation unavailable');
		await record.writer.probeCreationPublication(lease, id);
		this.assert(lease, id);
	}

	static expectLeafQuery(
		writer: ClimateAutomationWriterService,
		lease: DeviceCreationPublicationLease,
		runner: QueryRunner,
		query: string,
		parameters: readonly unknown[],
	): void {
		this.assert(lease);
		if (!writer.isCreationPublicationAcknowledged(lease) || leafQueries.has(runner))
			throw new Error('Original leaf query unavailable');
		leafQueries.set(runner, Object.freeze({ writer, lease, query, parameters: Object.freeze([...parameters]) }));
	}

	static endLeafQuery(
		writer: ClimateAutomationWriterService,
		lease: DeviceCreationPublicationLease,
		runner: QueryRunner,
	): void {
		const original = leafQueries.get(runner);
		if (original?.writer === writer && original.lease === lease) leafQueries.delete(runner);
	}

	/** A query runner alone is never an exemption; every exact statement/parameter vector is checked. */
	static observeQuery(
		source: DataSource,
		runner: QueryRunner,
		query: string,
		parameters: readonly unknown[] = [],
	): void {
		const text = query.trim();
		if (
			/^(?:SELECT\b(?![^;]*;\s*\S)|BEGIN(?: TRANSACTION)?$|COMMIT$|ROLLBACK$|SAVEPOINT\b|RELEASE SAVEPOINT\b|ROLLBACK TO SAVEPOINT\b)/i.test(
				text,
			)
		)
			return;
		// Coordination claims do not change catalog, ownership, graph or published values.
		if (/^(?:INSERT INTO|UPDATE|DELETE FROM) "devices_module_property_value_locks"(?:\s|$)/i.test(text)) return;
		const originalLeaf = leafQueries.get(runner);
		const records = new Set<PublicationRecord>();
		for (const watched of publicationIds.values())
			for (const record of watched) if (record.source === source) records.add(record);
		for (const record of records) {
			if (
				originalLeaf?.lease === record.lease &&
				originalLeaf.writer === record.writer &&
				originalLeaf.query === query &&
				JSON.stringify(originalLeaf.parameters) === JSON.stringify(parameters) &&
				record.writer.isCreationPublicationAcknowledged(record.lease)
			)
				continue;
			if (record.writer.isOriginalCreationMutation(record.lease, runner, query, parameters)) continue;
			record.active = false;
		}
	}

	static invalidateAll(): void {
		for (const entries of readCacheIds.values())
			for (const token of entries) {
				const record = readCacheRecords.get(token);
				if (record) record.changed = true;
			}
		for (const records of publicationIds.values()) for (const record of records) record.active = false;
	}

	static runJob(lease: DeviceCreationPublicationLease, job: OwnedCreationCatalogJob): Promise<void> {
		this.assert(lease, job.row.id);
		return (async () => {
			this.assert(lease, job.row.id);
			if (job.hook !== undefined) {
				if (typeof job.hook !== 'function') throw new Error('Original creation hook unavailable');
				const callable: ReceiverFunction<object, [DeviceEntity | ChannelEntity | ChannelPropertyEntity], unknown> =
					job.hook;
				if (job.kind === 'device') {
					const deviceHook: ReceiverFunction<
						object,
						[DeviceEntity | ChannelEntity | ChannelPropertyEntity, object | undefined],
						unknown
					> = job.hook;
					await deviceHook.call(job.mapping, job.row, job.input);
				} else await callable.call(job.mapping, job.row);
				this.assert(lease, job.row.id);
			}
			const event =
				job.kind === 'device'
					? EventType.DEVICE_CREATED
					: job.kind === 'channel'
						? EventType.CHANNEL_CREATED
						: EventType.CHANNEL_PROPERTY_CREATED;
			if (!creationMethodCurrent(job.events, 'emit', job.emit)) throw new Error('Original event emitter lost');
			if (job.kind === 'device' && job.row instanceof DeviceEntity) await this.dispatchRequired(lease, job, job.row);
			else {
				this.assert(lease, job.row.id);
				const report = publicationRecords.get(lease);
				if (report) report.attempted++;
				job.emit.call(job.events, event, job.row);
				if (report) report.completed++;
				this.assert(lease, job.row.id);
			}
		})();
	}

	static registerInformationHandler(
		events: EventEmitter2,
		receiver: object,
		method: unknown,
		chainCurrent: () => boolean,
	): Readonly<{ dispose: () => void }> {
		const previous = informationRegistrations.get(events);
		if (previous?.active) throw new Error('Owned information handler already registered');
		if (typeof method !== 'function' || !creationMethodCurrent(receiver, 'handleDeviceCreated', method))
			throw new Error('Owned information handler unavailable');
		const registration: InformationRegistration = { active: true, receiver, method, events, chainCurrent };
		informationRegistrations.set(events, registration);
		return Object.freeze({
			dispose: () => {
				registration.active = false;
				if (informationRegistrations.get(events) === registration) informationRegistrations.delete(events);
			},
		});
	}

	static captureInformation(events: EventEmitter2): CreationInformationHandlerCapture | null {
		const original = informationRegistrations.get(events);
		if (
			!original?.active ||
			!original.chainCurrent() ||
			!creationMethodCurrent(original.receiver, 'handleDeviceCreated', original.method)
		)
			return null;
		if (!creationHasDataMethod(events, 'listeners')) return null;
		const listenersOriginalMethods: Readonly<{ listeners: typeof events.listeners }> = events;
		const { listeners } = listenersOriginalMethods;
		const listCall: ReceiverFunction<
			EventEmitter2,
			[string | symbol],
			ReturnType<EventEmitter2['listeners']>
		> = listeners;
		const vector = Object.freeze([...listCall.call(events, EventType.DEVICE_CREATED)]);
		const supplied: unknown = Reflect.getMetadata('EVENT_LISTENER_METADATA', original.method);
		if (!Array.isArray(supplied) || supplied.length !== 1) return null;
		const item: unknown = supplied[0];
		if (!item || typeof item !== 'object') return null;
		const eventDescriptor = Object.getOwnPropertyDescriptor(item, 'event');
		const optionsDescriptor = Object.getOwnPropertyDescriptor(item, 'options');
		if (
			!eventDescriptor ||
			eventDescriptor.get ||
			eventDescriptor.set ||
			eventDescriptor.value !== EventType.DEVICE_CREATED ||
			!optionsDescriptor ||
			optionsDescriptor.get ||
			optionsDescriptor.set ||
			optionsDescriptor.value !== undefined
		)
			return null;
		const currentMetadata = (): boolean =>
			Reflect.getMetadata('EVENT_LISTENER_METADATA', original.method) === supplied &&
			supplied.length === 1 &&
			supplied[0] === item &&
			Object.getOwnPropertyDescriptor(item, 'event')?.value === EventType.DEVICE_CREATED &&
			Object.getOwnPropertyDescriptor(item, 'event')?.get === undefined &&
			Object.getOwnPropertyDescriptor(item, 'options')?.value === undefined &&
			Object.getOwnPropertyDescriptor(item, 'options')?.get === undefined;
		const capture = Object.freeze(new CreationInformationHandlerCapture());
		informationCaptures.set(
			capture,
			Object.freeze({ registration: original, vector, listenersMethod: listeners, currentMetadata }),
		);
		return capture;
	}

	static informationCurrent(capture: CreationInformationHandlerCapture): boolean {
		const captured = informationCaptures.get(capture);
		if (!captured || !captured.currentMetadata()) return false;
		const original = captured.registration;
		if (
			!original.active ||
			!original.chainCurrent() ||
			informationRegistrations.get(original.events) !== original ||
			!creationMethodCurrent(original.receiver, 'handleDeviceCreated', original.method) ||
			!creationMethodCurrent(original.events, 'listeners', captured.listenersMethod)
		)
			return false;
		const call: ReceiverFunction<
			EventEmitter2,
			[string | symbol],
			ReturnType<EventEmitter2['listeners']>
		> = captured.listenersMethod;
		const vector = call.call(original.events, EventType.DEVICE_CREATED);
		return (
			vector.length === captured.vector.length && captured.vector.every((listener, index) => listener === vector[index])
		);
	}

	/** Runs synchronously INSIDE the real @OnEvent method, before its first await. */
	static enterInformation(
		device: DeviceEntity,
		receiver: object,
	):
		| Readonly<{
				lease: DeviceCreationPublicationLease;
				gate: Promise<void>;
				finish: (failure?: { cause: unknown }) => void;
		  }>
		| undefined {
		const invocation = requiredInvocations.get(device);
		if (!invocation) return undefined;
		if (invocation === closedRequiredInvocation) throw new Error('Original creation publication closed');
		const registration = invocation.registration;
		this.assert(invocation.lease, device.id);
		if (
			invocation.entered ||
			!registration.active ||
			!registration.chainCurrent() ||
			registration.receiver !== receiver ||
			informationRegistrations.get(registration.events) !== registration ||
			!creationMethodCurrent(receiver, 'handleDeviceCreated', registration.method)
		) {
			invocation.reject(new Error('Original required information invocation refused'));
			throw new Error('Original required information invocation refused');
		}
		invocation.entered = true;
		return Object.freeze({
			lease: invocation.lease,
			gate: invocation.gate,
			finish: (failure?: { cause: unknown }) => {
				if (invocation.settled) return;
				invocation.settled = true;
				const record = publicationRecords.get(invocation.lease);
				if (record) {
					record.settled++;
					if (failure) {
						record.failed++;
						record.failure ??= failure;
					}
				}
				if (failure) invocation.reject(failure.cause);
				else invocation.release();
			},
		});
	}

	private static async dispatchRequired(
		lease: DeviceCreationPublicationLease,
		job: OwnedCreationCatalogJob,
		device: DeviceEntity,
	): Promise<void> {
		const registration = publicationRecords.get(lease)?.information;
		if (
			!registration?.active ||
			!registration.chainCurrent() ||
			registration.events !== job.events ||
			informationRegistrations.get(job.events) !== registration ||
			!creationMethodCurrent(registration.receiver, 'handleDeviceCreated', registration.method)
		)
			throw new Error('Required information handler unavailable');
		const listeners = job.events.listeners(EventType.DEVICE_CREATED);
		let release!: () => void;
		let reject!: (cause: unknown) => void;
		let openGate!: () => void;
		const pending = new Promise<void>((resolve, refuse) => {
			release = resolve;
			reject = refuse;
		});
		const gate = new Promise<void>((resolve) => {
			openGate = resolve;
		});
		const record = publicationRecords.get(lease);
		if (!record || record.closed) throw new Error('Creation publication closed');
		const invocation: RequiredInvocation = {
			lease,
			registration,
			pending,
			release,
			reject,
			gate,
			openGate,
			entered: false,
			settled: false,
		};
		record.children.push(pending);
		record.admitted++;
		void pending.catch((cause: unknown) => {
			record.failure ??= { cause };
		});
		requiredInvocations.set(device, invocation);
		try {
			this.assert(lease, device.id);
			record.attempted++;
			job.emit.call(job.events, EventType.DEVICE_CREATED, device);
			record.completed++;
			if (
				!invocation.entered ||
				informationRegistrations.get(job.events) !== registration ||
				listeners.length !== job.events.listeners(EventType.DEVICE_CREATED).length ||
				listeners.some((listener, index) => listener !== job.events.listeners(EventType.DEVICE_CREATED)[index])
			)
				throw new Error('Required synchronous handler admission unavailable');
			this.assert(lease, device.id);
			openGate();
			await pending;
			this.assert(lease, device.id);
		} catch (cause) {
			record.failure ??= { cause };
			// A throwing emitter is not completion of an already admitted real async handler.
			// Open its gate in the failed scope and drain its OWN finally before returning the primary error.
			openGate();
			if (!invocation.entered) reject(cause);
			try {
				await pending;
			} catch {
				/* Original emitter/admission cause remains primary. */
			}
			throw cause;
		} finally {
			openGate();
			// Retain the weak payload marker: redelivery of this owned payload must never fall back to ordinary work.
		}
	}

	static close(lease: DeviceCreationPublicationLease): void {
		const record = publicationRecords.get(lease);
		if (!record) return;
		record.active = false;
		record.closed = true;
		// Keep only a terminal anti-redelivery marker, not handler/service/Promise/manager retention.
		if (record.catalog && requiredInvocations.has(record.catalog))
			requiredInvocations.set(record.catalog, closedRequiredInvocation);
		overlapReadCaches(record.identities);
		for (const id of record.identities) {
			const records = publicationIds.get(id);
			records?.delete(record);
			if (records?.size === 0) publicationIds.delete(id);
		}
		publicationRecords.delete(lease);
	}
}

/** Original module-evaluation function objects; replacements can only veto, never rescue. */
type ReadReceiverCall<Receiver, Args extends unknown[], Result> = Readonly<{
	call: (receiver: Receiver, ...args: Args) => Result;
}>;
const readCacheEngine: Readonly<{
	observeReadCache: (id: string, status?: boolean) => ReadCacheObservation;
	finishReadCache: (token: ReadCacheObservation, binding?: StatusReadBinding) => ReadCacheDecision;
	closeReadCache: (token: ReadCacheObservation) => void;
	dirtyReadCache: (ids: readonly string[]) => void;
	noteStatusPropertyDeletion: (id: string) => void;
	stagingCurrent: (lease: DeviceCreationPublicationLease) => boolean;
}> = DeviceCreationPublicationEngine;
const readCacheFunctions: Readonly<{
	observe: ReadReceiverCall<
		typeof DeviceCreationPublicationEngine,
		[id: string, status?: boolean],
		ReadCacheObservation
	>;
	finish: ReadReceiverCall<
		typeof DeviceCreationPublicationEngine,
		[token: ReadCacheObservation, binding?: StatusReadBinding],
		ReadCacheDecision
	>;
	close: ReadReceiverCall<typeof DeviceCreationPublicationEngine, [token: ReadCacheObservation], void>;
	dirty: ReadReceiverCall<typeof DeviceCreationPublicationEngine, [ids: readonly string[]], void>;
	deleted: ReadReceiverCall<typeof DeviceCreationPublicationEngine, [id: string], void>;
	createdCurrent: ReadReceiverCall<
		typeof DeviceCreationPublicationEngine,
		[lease: DeviceCreationPublicationLease],
		boolean
	>;
}> = Object.freeze({
	observe: readCacheEngine.observeReadCache,
	finish: readCacheEngine.finishReadCache,
	close: readCacheEngine.closeReadCache,
	dirty: readCacheEngine.dirtyReadCache,
	deleted: readCacheEngine.noteStatusPropertyDeletion,
	createdCurrent: readCacheEngine.stagingCurrent,
});
const readCacheNames = Object.freeze({
	observe: 'observeReadCache',
	finish: 'finishReadCache',
	close: 'closeReadCache',
	dirty: 'dirtyReadCache',
	deleted: 'noteStatusPropertyDeletion',
	createdCurrent: 'stagingCurrent',
});
export const originalReadCacheApi = Object.freeze({
	receiver: DeviceCreationPublicationEngine,
	...readCacheFunctions,
	current: (): boolean =>
		Object.entries(readCacheNames).every(([key, name]) => {
			const expected: unknown = Reflect.get(readCacheFunctions, key);
			const descriptor = Object.getOwnPropertyDescriptor(DeviceCreationPublicationEngine, name);
			return descriptor?.get === undefined && descriptor?.set === undefined && descriptor?.value === expected;
		}),
});

/** Original persisted discriminator facts only; public plugin type remains a separate check. */
export interface DeviceCreationNativeCatalog {
	readonly device: DeviceCreationNativeCatalogRole;
	readonly channel: DeviceCreationNativeCatalogRole;
	readonly property: DeviceCreationNativeCatalogRole;
}

interface DeviceCreationNativeCatalogRole {
	readonly tableName: string;
	readonly discriminatorColumn: string;
	readonly discriminatorValue: string | number;
}

export interface DeviceCreationEnvironment {
	readonly nativeCatalog: DeviceCreationNativeCatalog;
	readonly identities: readonly string[];
	readonly admitIdentities: (ids: readonly string[]) => void;
	readonly graphGuardSource: Readonly<{ capturePublishGuard: () => () => boolean }>;
	readonly destinations: CreationStorageDestinations;
	readonly publishConfiguration: (
		lease: DeviceCreationPublicationLease,
		plan: import('../contracts/climate-automation.contract').ClimateAutomationCreationPlan,
	) => Promise<void>;
	readonly source: DataSource;
	readonly events: EventEmitter2;
	readonly information: CreationInformationHandlerCapture;
	readonly producers: PropertyProducerRegistryService;
	readonly producerObservation: () => CreationProducerObservation;
	readonly isCurrent: () => boolean;
	readonly mappingCurrent: OwnedCreationContextRecord['mappingCurrent'];
	readonly close: () => void;
}

/** Descriptor inspection never invokes a method getter while deciding owned eligibility. */
export function creationHasDataMethod(receiver: object, key: string): boolean {
	for (let current: object | null = receiver; current; ) {
		const descriptor = Object.getOwnPropertyDescriptor(current, key);
		if (descriptor)
			return descriptor.get === undefined && descriptor.set === undefined && typeof descriptor.value === 'function';
		const parent: unknown = Object.getPrototypeOf(current);
		current = typeof parent === 'object' && parent !== null ? parent : null;
	}
	return false;
}

/** Owned payload only. Date setters cannot mutate the original instant through a frozen Date's internal slot. */
export function freezeCreationSnapshot<T extends object>(value: T, visited = new WeakSet<object>()): T {
	if (value instanceof Date)
		return new Proxy(value, {
			get(target, key) {
				const member: unknown = Reflect.get(target, key);
				if (typeof member !== 'function') return member;
				if (typeof key === 'string' && key.startsWith('set'))
					return () => {
						throw new Error('Immutable creation instant');
					};
				return (...args: unknown[]): unknown => Reflect.apply(member, target, args);
			},
			set() {
				return false;
			},
			defineProperty() {
				return false;
			},
			deleteProperty() {
				return false;
			},
		});
	if (Object.isFrozen(value) || visited.has(value)) return value;
	visited.add(value);
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || descriptor.get || descriptor.set) continue;
		const child: unknown = descriptor.value;
		if (child && typeof child === 'object')
			Object.defineProperty(value, key, { ...descriptor, value: freezeCreationSnapshot(child, visited) });
	}
	return Object.freeze(value);
}

export function creationDataMemberCurrent(receiver: object, key: string): boolean {
	for (let current: object | null = receiver; current; ) {
		const descriptor = Object.getOwnPropertyDescriptor(current, key);
		if (descriptor) return descriptor.get === undefined && descriptor.set === undefined;
		const parent: unknown = Object.getPrototypeOf(current);
		current = parent && typeof parent === 'object' ? parent : null;
	}
	return false;
}
