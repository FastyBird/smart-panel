import { EntityManager, QueryRunner } from 'typeorm';

import {
	SqliteCommitGuardReceipt,
	observeSqliteOuterOutcome,
	registerSqliteCommitGuard,
} from '../../../common/database/sqlite-data-source';
import { createExtensionLogger } from '../../../common/logger/extension-logger.service';
import { DEVICES_MODULE_NAME } from '../devices.constants';

import type { ChannelTypeMapping } from './channels-type-mapper.service';
import type { ChannelPropertyTypeMapping } from './channels.properties-type-mapper.service';
import { CreationCapture } from './creation-capture';
import type { DeviceTypeMapping } from './devices-type-mapper.service';

const pinned = new WeakSet<DeviceCreationContext>();
const records = new WeakMap<DeviceCreationContext, PinnedCreation>();

const admitted = new WeakSet<DeviceCreationContext>();
const admission = Symbol('internal-device-creation');
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

	/** Only the thermostat creation consumer opts into exact outer admission. Legacy run stays unchanged. */
	static async runPinned<T>(
		writer: (work: (manager: EntityManager) => Promise<T>, admit: (manager: EntityManager) => void) => Promise<T>,
		catalog: CreationCatalog,
		ownerCurrent: () => boolean,
		operation: (context: DeviceCreationContext) => Promise<T>,
		settlement: CreationSettlement<T>,
	): Promise<T> {
		let context: DeviceCreationContext | undefined;
		let record: PinnedCreation | undefined;
		try {
			const result = await writer(
				async (manager) => {
					if (!context || manager !== record.manager) throw new Error('Original creation manager required');
					try {
						settlement.result = { value: await operation(context) };
					} catch (cause) {
						record.failure ??= { cause };
					}
					// Close root/external admission BEFORE the first drain await. Fixed descendants keep their grants.
					record.phase = 'DRAINING';
					context.active = false;
					while (record.children.size) await Promise.all(record.children);
					context.checkPinned(record);
					if (!settlement.result) throw new Error('Creation result is missing');
					record.phase = 'READY';
					return settlement.result.value;
				},
				(manager) => {
					if (record) throw new Error('Creation owner cannot be replaced');
					const receipt = observeSqliteOuterOutcome(manager); // Rejects nested SAVEPOINT and foreign manager.
					settlement.receipt = receipt;
					context = new DeviceCreationContext(manager, 'virtual', admission);
					record = {
						manager,
						runner: manager.queryRunner,
						catalog,
						ownerCurrent,
						phase: 'OPEN',
						children: new Set(),
						contexts: new Set(),
						publications: context.publications,
					};
					pinned.add(context);
					records.set(context, record);
					record.contexts.add(context);
					registerSqliteCommitGuard(
						manager,
						() =>
							record.phase === 'READY' &&
							!record.failure &&
							record.children.size === 0 &&
							manager === record.manager &&
							manager.queryRunner === record.runner &&
							record.runner.manager === manager &&
							record.runner.isTransactionActive &&
							record.ownerCurrent() &&
							record.catalog.current(),
					);
					context.checkPinned(record);
				},
			);
			if (settlement.outcome !== 'committed') throw new Error('Missing original native creation ACK');
			// Preserve legacy callback ordering/isolation INSIDE the caller's existing structural lock.
			for (const publication of context.publications) {
				try {
					if (!catalog.current()) throw new Error('Original creation publication registration expired');
					await publication.publish();
				} catch (cause) {
					logger.error(
						'Device creation committed, but post-commit publication failed',
						cause instanceof Error ? cause : new Error('Creation publication rejected', { cause }),
					);
				}
			}
			return result;
		} catch (cause) {
			throw new DeviceCreationSettlementError(settlement, record?.failure ? record.failure.cause : cause, cause);
		} finally {
			if (record) {
				record.phase = 'SETTLED';
				record.children.clear();
				record.catalog = undefined;
				record.ownerCurrent = () => false;
				record.failure = undefined;
				for (const own of record.contexts) {
					own.active = false;
					records.delete(own);
					own.node = undefined;
				}
				record.contexts.clear();
			}
			if (context) {
				context.active = false;
				context.publications.length = 0;
				records.delete(context);
			}
		}
	}

	static check<T>(context: DeviceCreationContext | undefined, work: () => Promise<T>): Promise<T> {
		if (!this.isPinned(context)) return work();
		context.assertActive();
		return work().then((result) => {
			context.assertActive();
			return result;
		});
	}

	assertPublication(): void {
		if (pinned.has(this) && records.get(this)?.catalog.current() !== true)
			throw new Error('Original creation dispatch expired');
	}

	static assertGenuine(context: DeviceCreationContext | undefined): void {
		if (context !== undefined && !admitted.has(context)) throw new Error('Genuine device creation context required');
	}

	assertParent(id: string): void {
		this.assertActive();
		if (this.node?.parentId !== id) throw new Error('Original creation parent required');
	}

	static isPinned(context: DeviceCreationContext | undefined): boolean {
		return context !== undefined && pinned.has(context);
	}

	private node?: CatalogNode;

	/** Enroll the WHOLE real catalog promise synchronously, before any input traversal or hook. */
	catalog<T>(kind: CatalogKind, input: CatalogInput, work: (child: DeviceCreationContext) => Promise<T>): Promise<T> {
		const record = records.get(this);
		if (!admitted.has(this) || !this.active) throw new Error('Device creation context is not active');
		if (
			!record ||
			(this.node ? this.node.started || this.node.kind !== kind || this.node.input !== input : record.phase !== 'OPEN')
		)
			throw new Error('Creation catalog admission is closed');
		this.checkPinned(record);
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (cause: unknown) => void;
		const task = new Promise<T>((yes, no) => {
			resolve = yes;
			reject = no;
		});
		const child = new DeviceCreationContext(this.manager, this.allowedType, admission);
		pinned.add(child);
		records.set(child, record);
		record.contexts.add(child);
		const settled = task.then(
			() => finish(),
			(cause: unknown) => {
				record.failure ??= { cause };
				finish();
			},
		);
		const finish = () => {
			child.active = false;
			record.children.delete(settled);
		};
		record.children.add(settled);
		try {
			child.node = this.node ?? catalogNode(kind, input);
			child.node.started = true;
			resolve(work(child));
		} catch (cause) {
			reject(cause);
		}
		return task;
	}

	/** Inputs/grants are fixed before the original catalog traversal first awaits. */
	descendants(): readonly CatalogInput[] {
		this.assertActive();
		return this.node.children.map((node) => node.input);
	}

	child(index: number): DeviceCreationContext {
		this.assertActive();
		const node = this.node.children[index];
		if (!node || node.started) throw new Error('Original catalog descendant required');
		const child = new DeviceCreationContext(this.manager, this.allowedType, admission);
		child.node = node;
		pinned.add(child);
		records.set(child, records.get(this));
		records.get(this).contexts.add(child);
		return child;
	}

	mapping<K extends CatalogKind>(kind: K): CreationCatalog[K] {
		this.assertActive();
		return records.get(this).catalog[kind];
	}

	/** Check before input getters, after every awaited boundary, and before inserts/deferred work. */
	assertActive(): void {
		if (!admitted.has(this) || !this.active) throw new Error('Device creation context is not active');
		if (pinned.has(this)) {
			const record = records.get(this);
			if (!record || (record.phase !== 'OPEN' && !(record.phase === 'DRAINING' && this.node?.started)))
				throw new Error('Creation catalog admission is closed');
			this.checkPinned(record);
		}
	}

	private checkPinned(record: PinnedCreation): void {
		if (record.failure) throw record.failure.cause;
		if (
			this.manager !== record.manager ||
			this.manager.queryRunner !== record.runner ||
			record.runner.manager !== this.manager ||
			!record.runner.isTransactionActive ||
			!record.ownerCurrent() ||
			!record.catalog.current()
		) {
			record.failure ??= { cause: new Error('Original creation owner or catalog expired') };
			throw record.failure.cause;
		}
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
		this.assertActive();
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
		(pinned.has(this) ? records.get(this).publications : this.publications).push({
			publish: publication,
			requiresActivation,
		});
	}
}

export type CatalogKind = 'device' | 'channel' | 'property';
export type CatalogInput = { id?: string; channels?: CatalogInput[]; properties?: CatalogInput[]; device?: string };
interface CatalogNode {
	kind: CatalogKind;
	input: CatalogInput;
	children: CatalogNode[];
	started?: boolean;
	parentId?: string;
}
function catalogNode(kind: CatalogKind, input: CatalogInput, parentId?: string): CatalogNode {
	const children =
		kind === 'device'
			? (input.channels ?? []).map((channel) => catalogNode('channel', { ...channel, device: input.id }, input.id))
			: kind === 'channel'
				? (input.properties ?? []).map((property) => catalogNode('property', property, input.id))
				: [];
	return { kind, input, children, parentId };
}
export interface CreationCatalog {
	device: CreationCapture<DeviceTypeMapping<any, any, any>>;
	channel: CreationCapture<ChannelTypeMapping<any, any, any>>;
	property: CreationCapture<ChannelPropertyTypeMapping<any, any, any>>;
	current: () => boolean;
}
interface PinnedCreation {
	manager: EntityManager;
	runner: QueryRunner;
	catalog: CreationCatalog;
	ownerCurrent: () => boolean;
	phase: 'OPEN' | 'DRAINING' | 'READY' | 'SETTLED';
	children: Set<Promise<void>>;
	contexts: Set<DeviceCreationContext>;
	publications: { publish: () => Promise<void> | void; requiresActivation: boolean }[];
	failure?: { cause: unknown };
}
/** Result presence and historical ACK are independent of any later settlement error. */
export class CreationSettlement<T> {
	receipt?: SqliteCommitGuardReceipt;
	result?: { value: T };
	get outcome() {
		return this.receipt?.outcome ?? 'not_started';
	}
}
export class DeviceCreationSettlementError<T = unknown> extends Error {
	constructor(
		readonly settlement: CreationSettlement<T>,
		cause: unknown,
		readonly settlementCause: unknown,
	) {
		super('Device creation settlement failed', { cause });
	}
}
