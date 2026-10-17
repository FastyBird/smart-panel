import { createHash } from 'node:crypto';
import { EntityManager } from 'typeorm';

/** PRIVATE core protocol. No HTTP/Swagger schema, runtime frame or physical authority. */
export type ClimateAutomationJson =
	| null
	| boolean
	| number
	| string
	| readonly ClimateAutomationJson[]
	| { readonly [key: string]: ClimateAutomationJson };

export function climateAutomationCanonical(value: unknown): string {
	if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
	if (typeof value === 'number') {
		if (!Number.isFinite(value)) throw new Error('Non-finite private climate value');
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((item: unknown) => climateAutomationCanonical(item)).join(',')}]`;
	if (typeof value !== 'object') throw new Error('Invalid private climate JSON');
	return `{${Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${climateAutomationCanonical(Reflect.get(value, key))}`)
		.join(',')}}`;
}

/** Validate and copy private JSON; never retain mutable provider-owned evidence objects. */
export function climateAutomationJson(value: unknown): ClimateAutomationJson {
	if (value === null) return null;
	if (typeof value === 'boolean' || typeof value === 'string') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return Object.freeze(value.map((item: unknown) => climateAutomationJson(item)));
	if (typeof value !== 'object' || value === null) throw new Error('Invalid private climate JSON');
	const result: Record<string, ClimateAutomationJson> = {};
	for (const key of Object.keys(value)) {
		const item: unknown = Reflect.get(value, key);
		Object.defineProperty(result, key, { value: climateAutomationJson(item), enumerable: true });
	}
	return Object.freeze(result);
}

export function climateAutomationDigest(value: ClimateAutomationJson): string {
	return createHash('sha256').update(climateAutomationCanonical(value)).digest('hex');
}

export type ClimateAutomationSourceState = 'PENDING' | 'FINALIZED_LIVE' | 'FINALIZED_INACTIVE' | 'REVOKED' | 'DELETED';
export type ClimateAutomationSlotState = 'EMPTY' | 'PROVISIONAL' | 'LIVE' | 'RETIRED' | 'LEGACY';

export interface ClimateAutomationSourceFacts {
	readonly generationId: string;
	readonly ownerId: string;
	readonly producerKey: string;
	readonly subjectId: string;
	readonly generationIndex: number;
	readonly revision: number;
	readonly isCurrent: boolean;
	readonly state: ClimateAutomationSourceState;
	readonly evidence: string;
	readonly evidenceDigest: string;
}

export interface ClimateAutomationSlotFacts {
	readonly controllerId: string;
	readonly providerKey: string;
	readonly controllerIncarnation: string;
	readonly slotRevision: number;
	readonly manualGeneration: string;
	readonly manualCounter: number;
	readonly manualHold: boolean;
	readonly state: ClimateAutomationSlotState;
	readonly ownerId: string | null;
	readonly baselineId: string | null;
	readonly generationId: string | null;
	readonly candidateId: string | null;
	readonly bundleId: string | null;
	readonly selection: string | null;
	readonly installEvidence: string | null;
	readonly legacyDigest: string | null;
}

/** Actual DB facts from the same reserved manager; no sample/session/availability claim. */
export interface ClimateAutomationControllerFacts {
	readonly controllerRevision: number;
	readonly graphRevision: number;
	readonly evidence: ClimateAutomationJson;
	readonly legacyBaseline: ClimateAutomationJson;
}

export interface ClimateAutomationProducer {
	readonly validateInManager: (
		manager: EntityManager,
		source: Readonly<ClimateAutomationSourceFacts>,
		purpose: 'prepare' | 'retire',
	) => Promise<ClimateAutomationJson | null>;
}

export interface ClimateAutomationProvider {
	/** Optional dormant edit port; never inferred from ordinary validation/creation methods. */
	readonly participantV1?: ClimateAutomationParticipant;
	readonly readControllerInManager: (
		manager: EntityManager,
		controllerId: string,
	) => Promise<ClimateAutomationControllerFacts | null>;
	readonly validateSelectionInManager: (
		manager: EntityManager,
		controllerId: string,
		facts: ClimateAutomationControllerFacts,
		selection: ClimateAutomationJson,
	) => Promise<boolean>;
	/** Trusted creation ONLY; called after config AND retained-slot checks. No network or nested transaction. */
	readonly createControllerInManager: (
		manager: EntityManager,
		controllerId: string,
		configuration: ClimateAutomationJson,
	) => Promise<void>;
}

export interface ClimateAutomationOwnedRegistration {
	readonly dispose: () => void;
}
export interface ClimateAutomationCapturedRegistration<T> {
	readonly implementation: T;
	readonly isCurrent: () => boolean;
}

/** Empty serializable shells. Actual identity is verified against writer-owned WeakMaps. */
export interface ClimateAutomationScope {
	readonly toJSON: () => Readonly<Record<string, never>>;
}
export interface ClimateAutomationHandle {
	readonly toJSON: () => Readonly<Record<string, never>>;
}
export type ClimateAutomationSelection = ClimateAutomationHandle | readonly ClimateAutomationHandle[];
export type ClimateAutomationConflictReason = 'stale' | 'uninitialized' | 'unavailable' | 'invalid';
export type ClimateAutomationCommittedOutcome =
	| {
			readonly outcome: 'applied' | 'unchanged';
			readonly items: readonly { readonly outcome: 'applied' | 'unchanged' }[];
	  }
	| { readonly outcome: 'conflict'; readonly reason: ClimateAutomationConflictReason };
export type ClimateAutomationCommitOutcome = 'not_started' | 'rolled_back' | 'refused' | 'unknown' | 'committed';

export class ClimateAutomationWriteError extends Error {
	constructor(
		readonly commitOutcome: ClimateAutomationCommitOutcome,
		cause: unknown,
	) {
		super('Private climate ownership operation failed', { cause });
		this.name = 'ClimateAutomationWriteError';
	}
	toJSON(): { outcome: 'error'; commitOutcome: ClimateAutomationCommitOutcome } {
		return { outcome: 'error', commitOutcome: this.commitOutcome };
	}
}


/** Private owned full projection. A concrete provider must audit every persisted field before registration. */
export interface ClimateAutomationParticipantDocument {
	readonly controllerId: string;
	readonly documentVersion: 1;
	readonly configuration: ClimateAutomationJson;
	readonly comfort: ClimateAutomationJson;
	readonly structural: ClimateAutomationJson;
	readonly legacyBaseline: ClimateAutomationJson;
}
export interface ClimateAutomationParticipantImage extends ClimateAutomationParticipantDocument {
	readonly controllerRevision: number;
}
export type ClimateAutomationReplacementKind = 'replace-configuration:v1' | 'replace-comfort:v1';
export interface ClimateAutomationReplacement {
	readonly kind: ClimateAutomationReplacementKind;
	readonly providerKey: string;
	readonly controllerId: string;
	readonly expected: ClimateAutomationHandle;
	readonly desiredDocument: ClimateAutomationJson;
}
export interface ClimateAutomationParticipantTurn extends ClimateAutomationScope {}
export interface ClimateAutomationValidationTicket extends ClimateAutomationScope {}
export interface ClimateAutomationAcknowledgedJob extends ClimateAutomationScope {}
export type ClimateAutomationParticipantPhase =
	| 'READ_BEFORE' | 'NORMALIZE' | 'APPLY' | 'READ_AFTER' | 'GRAPH_CAS' | 'FINAL_READ';
export interface ClimateAutomationGraphFacts {
	readonly revision: number;
	readonly edges: readonly { readonly outputPropertyId: string; readonly sourcePropertyId: string }[];
}
/** Complete TEST/dormant ownership plan derived from the original and normalized full projection.
 * C must audit complete concrete ownership; this is trusted read-only protocol, not a SQL sandbox.
 * Owned IDs are unique, edge arrays are multisets (duplicates are significant), empty is valid.
 */
export interface ClimateAutomationGraphReplacementPlan {
	readonly ownedOutputIds: readonly string[];
	readonly beforeEdges: ClimateAutomationGraphFacts['edges'];
	readonly replacementEdges: ClimateAutomationGraphFacts['edges'];
}
export interface ClimateAutomationGraphDelta {
	readonly before: ClimateAutomationGraphFacts;
	readonly plan: ClimateAutomationGraphReplacementPlan;
	/** Independently computed BEFORE APPLY; never replaced by observed post-apply edges. */
	readonly afterEdges: ClimateAutomationGraphFacts['edges'];
	readonly structuralBefore: ClimateAutomationJson;
	readonly structuralAfter: ClimateAutomationJson;
}
export type ClimateAutomationValidationReason =
	| 'original_identity_lost' | 'validation_superseded' | 'revision_mismatch' | 'missing_graph'
	| 'unsupported_legacy_listener' | 'listener_set_changed' | 'validation_rejected';
export type ClimateAutomationGraphValidation =
	| { readonly outcome: 'VALIDATED_AT_OBSERVED_REVISION'; readonly revision: number }
	| { readonly outcome: 'THIS_JOB_NOT_VALIDATED'; readonly reason: ClimateAutomationValidationReason };
export interface ClimateAutomationGraphParticipant {
	readonly readReservedGraph: (manager: EntityManager, turn: ClimateAutomationParticipantTurn) => Promise<ClimateAutomationGraphFacts>;
	readonly validateReservedReplacement: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, delta: ClimateAutomationGraphDelta) => Promise<void>;
	readonly beginReservedValidation: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, delta: ClimateAutomationGraphDelta) => ClimateAutomationValidationTicket;
	readonly advanceReservedGraph: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, delta: ClimateAutomationGraphDelta) => Promise<ClimateAutomationGraphFacts>;
	readonly validateAcknowledgedGraph: (job: ClimateAutomationAcknowledgedJob, ticket: ClimateAutomationValidationTicket, revision: number) => Promise<ClimateAutomationGraphValidation>;
}
/** Trusted SAME-manager protocol, NOT an EntityManager sandbox. No public caller-supplied functions. */
export interface ClimateAutomationParticipant {
	readonly version: 1;
	readonly graph: ClimateAutomationGraphParticipant;
	readonly readInManager: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, controllerId: string) => Promise<ClimateAutomationParticipantImage | null>;
	readonly normalizeInManager: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, kind: ClimateAutomationReplacementKind, desired: ClimateAutomationJson, before: ClimateAutomationParticipantImage) => Promise<ClimateAutomationParticipantDocument>;
	/** Read-only complete ownership projection; no helpers, writes or I/O. Inputs are owned immutable images. */
	readonly planGraphReplacementInManager: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, before: ClimateAutomationParticipantImage, next: ClimateAutomationParticipantDocument) => Promise<ClimateAutomationGraphReplacementPlan>;
	/** Exact affected-one controller CAS; no private source/slot or graph singleton writes, nested helpers or I/O. */
	readonly applyInManager: (manager: EntityManager, turn: ClimateAutomationParticipantTurn, before: ClimateAutomationParticipantImage, next: ClimateAutomationParticipantImage) => Promise<void>;
}
export class ClimateAutomationParticipantConflict extends Error {
	constructor(readonly reason: ClimateAutomationConflictReason) { super('Private climate participant conflict'); }
}
