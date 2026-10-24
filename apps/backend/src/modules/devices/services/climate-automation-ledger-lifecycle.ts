import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';

import {
	ClimateAutomationControllerFacts,
	ClimateAutomationJson,
	ClimateAutomationSlotFacts,
	ClimateAutomationSlotSnapshot,
	ClimateAutomationSourceFacts,
	ClimateAutomationSourceSnapshot,
} from '../contracts/climate-automation.contract';
import {
	CLIMATE_SLOT_TABLE,
	CLIMATE_SOURCE_TABLE,
	ClimateAutomationSlotEntity,
	ClimateAutomationSourceEntity,
} from '../entities/climate-automation.entity';

import {
	ClimateAutomationLedgerConflict as Conflict,
	canonical,
	increment,
	ownedJson,
} from './climate-automation-ledger.utils';

type Source = ClimateAutomationSourceSnapshot;
type Slot = ClimateAutomationSlotSnapshot;
type Validation = () => Promise<void>;
interface CapturedSlot {
	readonly controllerId: string;
	readonly providerKey?: string;
	readonly facts: ClimateAutomationSlotFacts | null;
	readonly controller: ClimateAutomationControllerFacts | null;
	readonly validateController?: Validation;
}

/** Inward access supplied only after the original ledger admits its manager/scope. No transaction owner. */
export interface LedgerLifecycleAccess {
	readonly manager: EntityManager;
	readonly source: (snapshot: Source) => ClimateAutomationSourceFacts;
	readonly slot: (snapshot: Slot) => CapturedSlot;
	readonly validate: (snapshot: Source | Slot) => Promise<void>;
	readonly producer: (key: string) => (source: ClimateAutomationSourceFacts) => Promise<void>;
	readonly provider: (
		key: string,
	) => (id: string, facts: ClimateAutomationControllerFacts, selection: ClimateAutomationJson) => Promise<void>;
	readonly issueSource: (facts: ClimateAutomationSourceFacts, validate: Validation) => Source;
	readonly issueSlot: (
		facts: ClimateAutomationSlotFacts,
		controller: ClimateAutomationControllerFacts | null,
		validate?: Validation,
	) => Slot;
}

/** Each entry captures synchronously and returns work for the existing ledger queue. */
export class ClimateAutomationLedgerLifecycle {
	constructor(private readonly access: LedgerLifecycleAccess) {}

	initializeSlot(request: Readonly<{ expected: Slot; releaseManualHold: boolean }>): () => Promise<Slot> {
		const expected = request.expected;
		const captured = this.access.slot(expected);
		const release = request.releaseManualHold;
		if (release !== true) throw new Conflict('invalid');
		return async () => {
			await this.access.validate(expected);
			const { facts: previous, controller, validateController, providerKey, controllerId } = captured;
			// Unlike E's initializer this only initializes sidecar metadata for an EXISTING controller.
			// Never create a controller, adopt legacy comfort, or clear a hold on an owned row.
			if (!controller || !validateController || !providerKey) throw new Conflict('unavailable');
			if ((previous && previous.state !== 'EMPTY') || controller.legacyBaseline !== null) throw new Conflict('stale');
			await validateController();
			const next: ClimateAutomationSlotFacts = Object.freeze({
				controllerId,
				providerKey,
				controllerIncarnation: previous?.controllerIncarnation ?? randomUUID(),
				slotRevision: previous ? increment(previous.slotRevision) : 1,
				manualGeneration: randomUUID(),
				manualCounter: previous ? increment(previous.manualCounter) : 1,
				manualHold: false,
				state: 'EMPTY',
				ownerId: null,
				baselineId: null,
				generationId: null,
				candidateId: null,
				bundleId: null,
				selection: null,
				installEvidence: null,
				legacyDigest: null,
			});
			await this.access.validate(expected);
			await this.writeSlot(previous, next);
			return this.access.issueSlot(next, controller, validateController);
		};
	}

	stageSlot(
		request: Readonly<{
			expectedSlot: Slot;
			expectedSource: Source;
			selection: ClimateAutomationJson;
			bundleId: string;
		}>,
	): () => Promise<Slot> {
		const expectedSlot = request.expectedSlot;
		const captured = this.access.slot(expectedSlot);
		if (!captured.providerKey) throw new Conflict('unavailable');
		const validateSelection = this.access.provider(captured.providerKey);
		const expectedSource = request.expectedSource;
		const source = this.access.source(expectedSource);
		const validateProducer = this.access.producer(source.producerKey);
		// Pin both registrations/methods before traversing caller JSON or subsequent getters.
		const selection = ownedJson(request.selection);
		const bundleId = request.bundleId;
		if (typeof bundleId !== 'string' || !bundleId) throw new Conflict('invalid');
		return async () => {
			const { facts: previous, controller, validateController } = captured;
			if (!previous || !controller || !validateController) throw new Conflict('unavailable');
			if (
				!source.isCurrent ||
				source.state !== 'PENDING' ||
				!['EMPTY', 'RETIRED'].includes(previous.state) ||
				previous.manualHold ||
				controller.legacyBaseline !== null
			)
				throw new Conflict('stale');
			const validate = async () => {
				await this.access.validate(expectedSource);
				await validateController();
				await validateProducer(source);
				await validateSelection(previous.controllerId, controller, selection);
				await validateController();
			};
			await validate();
			await this.access.validate(expectedSlot);
			await this.access.validate(expectedSource);
			const next: ClimateAutomationSlotFacts = Object.freeze({
				...previous,
				state: 'PROVISIONAL',
				slotRevision: increment(previous.slotRevision),
				ownerId: source.ownerId,
				generationId: source.generationId,
				baselineId: randomUUID(),
				candidateId: randomUUID(),
				bundleId,
				selection: canonical(selection),
				// Captured read facts, NOT a receipt proving a controller installation.
				installEvidence: canonical(controller),
				legacyDigest: null,
			});
			await this.writeSlot(previous, next, source);
			return this.access.issueSlot(next, controller, validate);
		};
	}

	retireSlot(expectedSlot: Slot, expectedSource: Source): () => Promise<Slot> {
		const { facts: previous } = this.access.slot(expectedSlot);
		const source = this.access.source(expectedSource);
		return async () => {
			await this.access.validate(expectedSlot);
			await this.access.validate(expectedSource);
			if (
				!previous ||
				previous.ownerId !== source.ownerId ||
				previous.generationId !== source.generationId ||
				!['PROVISIONAL', 'LIVE', 'RETIRED'].includes(previous.state)
			)
				throw new Conflict('stale');
			// Cleanup needs no disposed producer/provider; it changes no controller configuration.
			if (previous.state === 'RETIRED') return expectedSlot;
			const next = Object.freeze({
				...previous,
				state: 'RETIRED' as const,
				slotRevision: increment(previous.slotRevision),
			});
			await this.writeSlot(previous, next, source);
			return this.access.issueSlot(next, null, async () => {});
		};
	}

	revokeSource(expectedSource: Source, slots: readonly Slot[], deleted: boolean): () => Promise<Source> {
		const source = this.access.source(expectedSource);
		const expectedSlots = Object.freeze(
			Array.from(slots, (snapshot) => ({ snapshot, captured: this.access.slot(snapshot) })),
		);
		if (typeof deleted !== 'boolean') throw new Conflict('invalid');
		if (new Set(expectedSlots.map(({ captured }) => captured.controllerId)).size !== expectedSlots.length)
			throw new Conflict('invalid');
		return async () => {
			await this.access.validate(expectedSource);
			if (!source.isCurrent || (source.state === 'DELETED' && !deleted)) throw new Conflict('stale');
			const rows = await this.active(source);
			if (rows.length !== expectedSlots.length) throw new Conflict('stale');
			for (const { snapshot, captured } of expectedSlots) {
				await this.access.validate(snapshot);
				if (!rows.some((row) => canonical({ ...row }) === canonical(captured.facts))) throw new Conflict('stale');
			}
			for (const { captured } of expectedSlots) {
				const previous = captured.facts;
				const next = Object.freeze({
					...previous,
					state: 'RETIRED' as const,
					slotRevision: increment(previous.slotRevision),
				});
				await this.writeSlot(previous, next, source);
				this.access.issueSlot(next, null, async () => {});
			}
			const state = deleted ? 'DELETED' : 'REVOKED';
			const validate = () => this.requireInactive(source);
			if (source.state === state) {
				await validate();
				return this.access.issueSource(source, validate);
			}
			return this.writeSource(source, state, validate);
		};
	}

	finalizeInactive(expected: Source): () => Promise<Source> {
		const source = this.access.source(expected);
		const validateProducer = this.access.producer(source.producerKey);
		return async () => {
			if (!source.isCurrent || !['PENDING', 'FINALIZED_INACTIVE'].includes(source.state)) throw new Conflict('stale');
			const validate = async () => {
				await validateProducer(source);
				await this.requireInactive(source);
			};
			await validate();
			await this.access.validate(expected);
			if (source.state === 'FINALIZED_INACTIVE') return this.access.issueSource(source, validate);
			return this.writeSource(source, 'FINALIZED_INACTIVE', validate);
		};
	}

	private active(source: ClimateAutomationSourceFacts): Promise<ClimateAutomationSlotEntity[]> {
		return this.access.manager
			.createQueryBuilder(ClimateAutomationSlotEntity, 'slot')
			.where('slot.ownerId = :owner AND slot.generationId = :generation', {
				owner: source.ownerId,
				generation: source.generationId,
			})
			.andWhere("slot.state IN ('LIVE','PROVISIONAL')")
			.getMany();
	}
	private async requireInactive(source: ClimateAutomationSourceFacts): Promise<void> {
		if ((await this.active(source)).length) throw new Conflict('stale');
	}
	private async writeSource(
		previous: ClimateAutomationSourceFacts,
		state: ClimateAutomationSourceFacts['state'],
		validate: Validation,
	): Promise<Source> {
		const next = Object.freeze({ ...previous, state, revision: increment(previous.revision) });
		const query = this.access.manager.createQueryBuilder().update(ClimateAutomationSourceEntity).set(next);
		for (const column of Object.keys(previous) as (keyof ClimateAutomationSourceFacts)[])
			query.andWhere(`"${column}" IS :old_${column}`, { [`old_${column}`]: previous[column] });
		query.andWhere(
			`NOT EXISTS (SELECT 1 FROM "${CLIMATE_SLOT_TABLE}" slot WHERE slot."generationId" = :generation AND slot."state" IN ('LIVE','PROVISIONAL'))`,
			{ generation: previous.generationId },
		);
		if ((await query.execute()).affected !== 1) throw new Conflict('stale');
		return this.access.issueSource(next, validate);
	}
	private async writeSlot(
		previous: ClimateAutomationSlotFacts | null,
		next: ClimateAutomationSlotFacts,
		source?: ClimateAutomationSourceFacts,
	): Promise<void> {
		if (!previous) {
			await this.access.manager.insert(ClimateAutomationSlotEntity, next);
			return;
		}
		const query = this.access.manager.createQueryBuilder().update(ClimateAutomationSlotEntity).set(next);
		for (const column of Object.keys(previous) as (keyof ClimateAutomationSlotFacts)[])
			query.andWhere(`"${column}" IS :old_${column}`, { [`old_${column}`]: previous[column] });
		if (source) {
			const predicates = (Object.keys(source) as (keyof ClimateAutomationSourceFacts)[]).map((column) => {
				query.setParameter(`source_${column}`, source[column]);
				return `ledger_source."${column}" IS :source_${column}`;
			});
			query.andWhere(
				`EXISTS (SELECT 1 FROM "${CLIMATE_SOURCE_TABLE}" ledger_source WHERE ${predicates.join(' AND ')})`,
			);
		}
		if ((await query.execute()).affected !== 1) throw new Conflict('stale');
	}
}
